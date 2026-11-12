import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const config = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
const csp = config.match(/Content-Security-Policy = "([^"]+)"/)?.[1] ?? ''

test('security headers enforce HTTPS and block inline executable content', () => {
  assert.match(config, /Strict-Transport-Security = "max-age=31536000; includeSubDomains"/)
  assert.match(csp, /script-src 'self'(?:;|$)/)
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/)
})
