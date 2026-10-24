# Security review — 24 October 2026

Release: **3.3.1**. Reviewed main commit `de5df4c4c94b876ab974dca0fcc351601109eb22` (3.3.0), confirmed as the published Netlify production commit. Changes are prepared for PR review, not merged or published to production.

## Findings and fixes

| Finding | Evidence and impact | Fix |
| --- | --- | --- |
| Known vulnerable dependencies | Initial `pnpm audit --json`: 58 findings (2 critical, 31 high, 19 moderate, 6 low). These are package findings, not 58 independently exploitable app flaws. TanStack Start had a critical reflected-XSS advisory; the app's existing server-function block reduced exposure. Many other findings concerned development/build dependencies. | Update React Start to 1.168.60, align Router 1.170.41 and router-plugin 1.168.42, update Vite to 7.3.7 and the Netlify adapter to 1.3.19, refresh transitive dependencies, and override the pinned multipart parser to @fastify/busboy 3.2.4. Retain the server-function block. Final audit: zero known findings. |
| Login open redirect | URL normalization can turn a same-origin return path into a network-path reference. The old validator accepted it; the eventual Location header redirected externally. Reproduced at login and callback. This did not expose the HttpOnly session cookie to the other origin. | Reject normalized paths beginning with `//` at both entry and callback. |
| Signing-key request amplification | Ten unknown key IDs caused ten upstream requests; eight concurrent cold requests caused eight fetches. Could consume Auth0 limits and impair availability. | Share concurrent fetches, apply a 30-second per-isolate refresh cooldown including errors, and bound fetches to five seconds. Expired caches still fail closed. |
| Malformed-token and upstream error handling | A JSON-null JWT header threw an unhandled exception. Other malformed encodings and failed upstream replies were not consistently contained. No signature/authentication bypass was demonstrated. | Validate shape, size, encodings and required claims; catch decoding/verification failures; bound and handle code-exchange failures; explicitly retain fail-closed routing. |
| Protected-response caching | Successful auth previously passed through without enforcing no-store on the downstream response. | Set private/no-store and CDN no-store headers on protected responses. This prevents future HTTP-cache storage; it cannot erase content already displayed or downloaded. |
| Invalid advanced length | Calling the exported generator with NaN or undefined produced only the four seeded characters. The current slider does not supply these values. | Default invalid/non-finite values to 16 and retain finite-value bounds. |

## Validation

- 25 automated tests pass, including 12 auth tests using real RSA signatures with mocked Auth0 endpoints, 5 generation tests and 8 display tests.
- The first auth regression run against the old implementation failed 8 of 10 tests; the patched implementation passes all 12.
- Tests cover normalized redirects, state/PKCE, tampered signatures, algorithm rejection, required claims, key rotation, expired caches, unknown-key throttling, concurrent refreshes, upstream failures, protected caching and blocked server-function paths.
- Production build includes Netlify SSR output and successful root prerendering; TypeScript checks pass.
- No peer dependency conflicts. Dependency audit covers the full lockfile, including development dependencies; no advisories are suppressed.
- A read-only production request to `/auth/me` without a session returned 401/no-store. Netlify reports the current production edge function and a completed secret scan with no matches.

## Remaining limitations and operational effects

- The requested two-word/three-digit simple format remains **49,140,000 outcomes (~25.55 bits)**. It is unsuitable for resisting offline password guessing. Use Advanced mode at 16 characters or longer for long-term credentials; enforce temporary-password expiry/change requirements in the receiving system.
- The refresh cooldown is per edge isolate, not global denial-of-service protection. A new signing key may take up to 30 seconds to be recognized. Fresh cached keys remain usable during an upstream outage; expired keys do not.
- No-store reduces browser/CDN reuse of protected responses and can increase requests. Authentication cannot retract downloaded JavaScript or a page already open in a browser.
- Auth0 tenant signup, user admission and MFA settings were not accessible in this review. The gate admits tokens for the configured tenant and application; those account policies need separate verification.
- CSP still permits inline scripts for TanStack hydration. No user-controlled HTML injection sink was found in application code; removing inline permission needs a separately tested nonce/hash implementation.
- This is a source/dependency review with local regression testing, not an exhaustive penetration test. A real Auth0 login/logout on a Netlify preview remains a pre-production check. New upstream advisories can appear after this audit.

## References

- [TanStack reflected-XSS advisory and patched versions](https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8)
- [TanStack deserialization advisory](https://github.com/TanStack/router/security/advisories/GHSA-9m65-766c-r333)
- [Auth0 JWKS caching and rate-limiting guidance](https://github.com/auth0/node-jwks-rsa/blob/master/EXAMPLES.md)
- [Multipart-parser advisory](https://github.com/advisories/GHSA-gxm5-99cw-xjw9)
