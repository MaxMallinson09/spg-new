/// <reference types="@netlify/edge-functions" />

import type { Config, Context } from '@netlify/edge-functions'

/**
 * Auth0 gate for the whole site.
 *
 * The login flow runs here, at the edge, rather than in the React bundle. That
 * ordering is the entire point: if the bundle contained the login UI, the
 * bundle would have to be served to anonymous visitors, and "signed in" would
 * only ever hide the interface rather than restrict access to it.
 *
 * The session is the Auth0 ID token in an HttpOnly cookie, re-verified against
 * the tenant's JWKS on every request. Nothing signs it but Auth0, so the cookie
 * cannot be forged, and page JavaScript cannot read it.
 */

const SESSION_COOKIE = 'pb_session'
const VERIFIER_COOKIE = 'pb_verifier'
const STATE_COOKIE = 'pb_state'
const RETURN_COOKIE = 'pb_return'

const LOGIN_PATH = '/auth/login'
const CALLBACK_PATH = '/auth/callback'
const LOGOUT_PATH = '/auth/logout'
const ME_PATH = '/auth/me'

const FLOW_COOKIE_MAX_AGE = 600 // 10 minutes to complete a login round trip
const JWKS_TTL_MS = 10 * 60 * 1000

type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string; use?: string }

// Per-isolate cache. A declaration only; nothing executes at module scope.
let jwksCache: { domain: string; fetchedAt: number; keys: Jwk[] } | null = null

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const padding = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const binary = atob(input.replace(/-/g, '+').replace(/_/g, '/') + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomToken(byteLength = 32): string {
  const buffer = new Uint8Array(byteLength)
  crypto.getRandomValues(buffer)
  return base64UrlEncode(buffer)
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

async function fetchJwks(domain: string): Promise<Jwk[]> {
  const response = await fetch(`https://${domain}/.well-known/jwks.json`)
  if (!response.ok) return []
  const body = (await response.json()) as { keys?: Jwk[] }
  const keys = body.keys ?? []
  jwksCache = { domain, fetchedAt: Date.now(), keys }
  return keys
}

async function getSigningKey(domain: string, kid: string): Promise<CryptoKey | null> {
  const fresh = jwksCache && jwksCache.domain === domain && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS
  let keys = fresh ? jwksCache!.keys : await fetchJwks(domain)
  let jwk = keys.find((key) => key.kid === kid)
  // An unknown kid usually means the tenant rotated its signing keys, so take
  // one more look before rejecting the token.
  if (!jwk && fresh) {
    keys = await fetchJwks(domain)
    jwk = keys.find((key) => key.kid === kid)
  }
  if (!jwk) return null
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

type Claims = {
  sub?: string
  name?: string
  nickname?: string
  email?: string
  picture?: string
  exp?: number
  iat?: number
  iss?: string
  aud?: string | string[]
}

async function verifyIdToken(token: string, domain: string, clientId: string): Promise<Claims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [encodedHeader, encodedPayload, encodedSignature] = parts

  let header: { alg?: string; kid?: string }
  let claims: Claims
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader)))
    claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)))
  } catch {
    return null
  }

  // Pin the algorithm. Accepting whatever the header asks for is what makes
  // "alg: none" and RS256-to-HS256 confusion work.
  if (header.alg !== 'RS256' || !header.kid) return null

  const key = await getSigningKey(domain, header.kid)
  if (!key) return null

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlDecode(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  )
  if (!valid) return null

  const now = Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== 'number' || claims.exp <= now) return null
  if (typeof claims.iat === 'number' && claims.iat > now + 300) return null
  if (claims.iss !== `https://${domain}/`) return null
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!audience.includes(clientId)) return null

  return claims
}

/** Only same-site absolute paths, so ?returnTo= cannot become an open redirect. */
function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function clearFlowCookies(context: Context, secure: boolean) {
  for (const name of [VERIFIER_COOKIE, STATE_COOKIE, RETURN_COOKIE]) {
    context.cookies.set({ name, value: '', path: '/', httpOnly: true, secure, sameSite: 'Lax', maxAge: 0 })
  }
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } })
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url)
  const domain = Netlify.env.get('AUTH0_DOMAIN') ?? ''
  const clientId = Netlify.env.get('AUTH0_CLIENT_ID') ?? ''
  const secure = url.protocol === 'https:'

  if (!domain || !clientId) {
    return new Response(
      'Auth0 is not configured. Set AUTH0_DOMAIN and AUTH0_CLIENT_ID for this site, then redeploy.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } },
    )
  }

  const redirectUri = `${url.origin}${CALLBACK_PATH}`

  // ---- Start a login ----
  if (url.pathname === LOGIN_PATH) {
    const verifier = randomToken()
    const state = randomToken(16)
    const returnTo = safeReturnPath(url.searchParams.get('returnTo'))

    const cookieOptions = { path: '/', httpOnly: true, secure, sameSite: 'Lax' as const, maxAge: FLOW_COOKIE_MAX_AGE }
    context.cookies.set({ name: VERIFIER_COOKIE, value: verifier, ...cookieOptions })
    context.cookies.set({ name: STATE_COOKIE, value: state, ...cookieOptions })
    context.cookies.set({ name: RETURN_COOKIE, value: returnTo, ...cookieOptions })

    const authorize = new URL(`https://${domain}/authorize`)
    authorize.searchParams.set('response_type', 'code')
    authorize.searchParams.set('client_id', clientId)
    authorize.searchParams.set('redirect_uri', redirectUri)
    authorize.searchParams.set('scope', 'openid profile email')
    authorize.searchParams.set('state', state)
    authorize.searchParams.set('code_challenge', await pkceChallenge(verifier))
    authorize.searchParams.set('code_challenge_method', 'S256')
    return redirect(authorize.toString())
  }

  // ---- Finish a login ----
  if (url.pathname === CALLBACK_PATH) {
    const error = url.searchParams.get('error')
    if (error) {
      clearFlowCookies(context, secure)
      const description = url.searchParams.get('error_description') ?? error
      return new Response(`Sign-in failed: ${description}`, {
        status: 401,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      })
    }

    const code = url.searchParams.get('code')
    const returnedState = url.searchParams.get('state')
    const expectedState = context.cookies.get(STATE_COOKIE)
    const verifier = context.cookies.get(VERIFIER_COOKIE)

    // Missing or mismatched state means this callback was not started here.
    if (!code || !verifier || !expectedState || returnedState !== expectedState) {
      clearFlowCookies(context, secure)
      return redirect(LOGIN_PATH)
    }

    const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    })

    if (!tokenResponse.ok) {
      clearFlowCookies(context, secure)
      return new Response('Sign-in failed: could not exchange the authorization code.', {
        status: 401,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      })
    }

    const tokens = (await tokenResponse.json()) as { id_token?: string }
    const idToken = tokens.id_token
    const claims = idToken ? await verifyIdToken(idToken, domain, clientId) : null
    if (!idToken || !claims) {
      clearFlowCookies(context, secure)
      return new Response('Sign-in failed: the identity token did not verify.', {
        status: 401,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      })
    }

    const returnTo = safeReturnPath(context.cookies.get(RETURN_COOKIE))
    clearFlowCookies(context, secure)
    context.cookies.set({
      name: SESSION_COOKIE,
      value: idToken,
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      // Outlive the token by nothing: expiry is re-checked on every request.
      maxAge: Math.max(0, (claims.exp ?? 0) - Math.floor(Date.now() / 1000)),
    })
    return redirect(returnTo)
  }

  // ---- Log out ----
  if (url.pathname === LOGOUT_PATH) {
    context.cookies.set({
      name: SESSION_COOKIE,
      value: '',
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      maxAge: 0,
    })
    const logout = new URL(`https://${domain}/v2/logout`)
    logout.searchParams.set('client_id', clientId)
    logout.searchParams.set('returnTo', url.origin)
    return redirect(logout.toString())
  }

  // ---- Everything below here requires a valid session ----
  const sessionToken = context.cookies.get(SESSION_COOKIE)
  const session = sessionToken ? await verifyIdToken(sessionToken, domain, clientId) : null

  if (url.pathname === ME_PATH) {
    if (!session) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 401,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      })
    }
    return new Response(
      JSON.stringify({
        authenticated: true,
        name: session.name ?? session.nickname ?? session.email ?? null,
        email: session.email ?? null,
        picture: session.picture ?? null,
      }),
      { headers: { 'content-type': 'application/json', 'cache-control': 'no-store, private' } },
    )
  }

  if (!session) {
    // Documents get sent through the login flow. Anything else (the JS bundle,
    // CSS, fetches) gets a plain 401, because handing back a redirect to HTML
    // would just produce a confusing parse error in the browser.
    const wantsHtml = request.headers.get('accept')?.includes('text/html')
    if (!wantsHtml) {
      return new Response('Unauthorized', { status: 401, headers: { 'cache-control': 'no-store' } })
    }
    const target = `${LOGIN_PATH}?returnTo=${encodeURIComponent(url.pathname + url.search)}`
    return redirect(target)
  }

  // Authenticated: hand off to the static assets untouched.
  return
}

export const config: Config = {
  path: '/*',
}
