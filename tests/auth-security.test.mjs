import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../netlify/edge-functions/auth.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const origin = 'https://spg.example'
const domain = 'tenant.auth0.example'
const clientId = 'spg-client'
const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
const jwk = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), kid: 'known-key', use: 'sig' }
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const claims = () => ({ sub: 'auth0|test-user', iss: `https://${domain}/`, aud: clientId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })
async function token(payload = claims(), header = { alg: 'RS256', kid: jwk.kid }) {
  const input = `${encode(header)}.${encode(payload)}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(input))
  return `${input}.${Buffer.from(signature).toString('base64url')}`
}
function loadAuth(fetcher = async () => Response.json({ keys: [jwk] }), clock = Date) {
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, crypto, Request, Response, URL, URLSearchParams, TextEncoder, TextDecoder,
    Uint8Array, atob, btoa, AbortSignal, Date: clock, fetch: fetcher,
    Netlify: { env: { get: (name) => ({ AUTH0_DOMAIN: domain, AUTH0_CLIENT_ID: clientId })[name] } },
  })
  return exports.default
}
function context(initial = {}) {
  const values = new Map(Object.entries(initial))
  const written = []
  return {
    values, written, passed: false,
    cookies: { get: (name) => values.get(name), set: (cookie) => { written.push(cookie); values.set(cookie.name, cookie.value) } },
    next: async function () { this.passed = true; return new Response('protected document', { headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=3600' } }) },
  }
}
const request = (path, options) => new Request(origin + path, options)

test('login return paths stay local after browser normalization', async () => {
  const auth = loadAuth()
  for (const value of ['/a/..//attacker.example', '//attacker.example', '/\\attacker.example', '/%2e%2e//attacker.example']) {
    const ctx = context()
    const response = await auth(request('/auth/login?returnTo=' + encodeURIComponent(value)), ctx)
    assert.equal(response.status, 302)
    const stored = ctx.values.get('pb_return')
    assert.equal(new URL(stored, origin).origin, origin, value)
  }
  const ctx = context()
  await auth(request('/auth/login?returnTo=' + encodeURIComponent('/settings?theme=light#display')), ctx)
  assert.equal(ctx.values.get('pb_return'), '/settings?theme=light#display')
})

test('malformed session tokens are rejected without throwing or fetching keys', async () => {
  let fetches = 0
  const auth = loadAuth(async () => { fetches++; return Response.json({ keys: [jwk] }) })
  for (const bad of ['bad', `${encode(null)}.${encode(claims())}.AA`, `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode(null)}.AA`, `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode(claims())}.%%%`, 'a'.repeat(20000)]) {
    const ctx = context({ pb_session: bad })
    const response = await auth(request('/auth/me'), ctx)
    assert.equal(response.status, 401)
    assert.equal(ctx.passed, false)
  }
  assert.equal(fetches, 0)
})

test('unknown signing keys cannot trigger one upstream request per token', async () => {
  let fetches = 0
  const auth = loadAuth(async () => { fetches++; return Response.json({ keys: [jwk] }) })
  for (let i = 0; i < 10; i++) {
    const bad = await token(claims(), { alg: 'RS256', kid: `missing-${i}` })
    assert.equal((await auth(request('/auth/me'), context({ pb_session: bad }))).status, 401)
  }
  assert.equal(fetches, 1)
  assert.equal((await auth(request('/auth/me'), context({ pb_session: await token() }))).status, 200)
  assert.equal(fetches, 1)
})

test('concurrent cold requests share one JWKS fetch', async () => {
  let fetches = 0
  const auth = loadAuth(async () => { fetches++; await new Promise((resolve) => setTimeout(resolve, 10)); return Response.json({ keys: [jwk] }) })
  const session = await token()
  const responses = await Promise.all(Array.from({ length: 8 }, () => auth(request('/auth/me'), context({ pb_session: session }))))
  assert.ok(responses.every((r) => r.status === 200))
  assert.equal(fetches, 1)
})

test('valid signatures still require correct identity, issuer, audience and times', async () => {
  const auth = loadAuth()
  for (const overrides of [{ sub: undefined }, { iat: undefined }, { exp: 1 }, { iat: Math.floor(Date.now() / 1000) + 1000 }, { nbf: Math.floor(Date.now() / 1000) + 1000 }, { iss: 'https://attacker.example/' }, { aud: 'another-client' }, { aud: [clientId, 'another-client'] }, { azp: 'another-client' }]) {
    const response = await auth(request('/auth/me'), context({ pb_session: await token({ ...claims(), ...overrides }) }))
    assert.equal(response.status, 401, JSON.stringify(overrides))
  }
  assert.equal((await auth(request('/auth/me'), context({ pb_session: await token() }))).status, 200)
})

test('JWKS failures fail closed, are bounded, and do not cause request storms', async () => {
  for (const result of ['network', 'invalid-json', 'invalid-keys', 'http-error']) {
    let fetches = 0
    const auth = loadAuth(async (_url, options) => {
      fetches++
      assert.ok(options.signal)
      if (result === 'network') throw new Error('unavailable')
      if (result === 'invalid-json') return new Response('{')
      if (result === 'invalid-keys') return Response.json({ keys: null })
      return new Response('', { status: 503 })
    })
    const session = await token()
    for (let i = 0; i < 3; i++) assert.equal((await auth(request('/auth/me'), context({ pb_session: session }))).status, 401)
    assert.equal(fetches, 1)
  }
})

test('key rotation works after the refresh cooldown; expired caches fail closed', async () => {
  let now = Date.now()
  class Clock extends Date { static now() { return now } }
  let fetches = 0
  const rotated = { ...jwk, kid: 'rotated-key' }
  const auth = loadAuth(async () => { fetches++; return fetches === 3 ? new Response('', { status: 503 }) : Response.json({ keys: [fetches === 1 ? jwk : rotated] }) }, Clock)
  assert.equal((await auth(request('/auth/me'), context({ pb_session: await token() }))).status, 200)
  now += 31000
  const session = await token(claims(), { alg: 'RS256', kid: rotated.kid })
  assert.equal((await auth(request('/auth/me'), context({ pb_session: session }))).status, 200)
  now += 11 * 60 * 1000
  assert.equal((await auth(request('/auth/me'), context({ pb_session: session }))).status, 401)
  assert.equal(fetches, 3)
})

test('callback validates state and PKCE and rechecks stored return paths', async () => {
  const session = await token()
  let exchanges = 0
  const auth = loadAuth(async (url, options) => {
    if (url.endsWith('/oauth/token')) {
      exchanges++
      assert.equal(options.body.get('code_verifier'), 'test-verifier')
      return Response.json({ id_token: session })
    }
    return Response.json({ keys: [jwk] })
  })
  const initial = { pb_state: 'expected', pb_verifier: 'test-verifier', pb_return: '/a/..//attacker.example' }
  assert.equal((await auth(request('/auth/callback?code=test-code&state=wrong'), context(initial))).status, 302)
  assert.equal(exchanges, 0)
  const ctx = context(initial)
  const response = await auth(request('/auth/callback?code=test-code&state=expected'), ctx)
  assert.equal(response.headers.get('location'), '/')
  assert.equal(ctx.values.get('pb_session'), session)
  const cookie = ctx.written.find((c) => c.name === 'pb_session')
  assert.ok(cookie.httpOnly && cookie.secure && cookie.sameSite === 'Lax')
})

test('unauthenticated access and unused server-function endpoints stay blocked', async () => {
  const auth = loadAuth()
  assert.equal((await auth(request('/assets/app.js'), context())).status, 401)
  assert.equal((await auth(request('/', { headers: { accept: 'text/html' } }), context())).status, 302)
  for (const path of ['/_serverFn', '/_serverFn/example']) {
    assert.equal((await auth(request(path), context({ pb_session: await token() }))).status, 404)
  }
})

test('protected responses cannot be stored by browser or shared caches', async () => {
  const ctx = context({ pb_session: await token() })
  const response = await loadAuth()(request('/'), ctx)
  assert.equal(ctx.passed, true)
  assert.equal(await response.text(), 'protected document')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('netlify-cdn-cache-control'), 'no-store')
})

test('tampered signatures and unapproved algorithms never authenticate', async () => {
  const auth = loadAuth()
  const valid = await token()
  const [header, payload, signature] = valid.split('.')
  const changedPayload = encode({ ...claims(), sub: 'auth0|someone-else' })
  for (const bad of [`${header}.${changedPayload}.${signature}`, await token(claims(), { alg: 'HS256', kid: jwk.kid }), await token(claims(), { alg: 'none', kid: jwk.kid })]) {
    assert.equal((await auth(request('/auth/me'), context({ pb_session: bad }))).status, 401)
  }
  assert.ok(payload)
})

test('token exchange failures clear the login flow without creating a session', async () => {
  for (const result of ['network', 'invalid-json', 'invalid-token', 'http-error']) {
    const auth = loadAuth(async (_url, options) => {
      assert.ok(options.signal)
      if (result === 'network') throw new Error('unavailable')
      if (result === 'invalid-json') return new Response('{')
      if (result === 'invalid-token') return Response.json({ id_token: {} })
      return new Response('', { status: 503 })
    })
    const ctx = context({ pb_state: 'expected', pb_verifier: 'test-verifier' })
    const response = await auth(request('/auth/callback?code=test-code&state=expected'), ctx)
    assert.equal(response.status, 401)
    assert.equal(ctx.values.has('pb_session'), false)
    assert.equal(ctx.values.get('pb_state'), '')
    assert.equal(ctx.values.get('pb_verifier'), '')
  }
})
