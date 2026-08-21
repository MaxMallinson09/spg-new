# AGENTS.md

This document provides an overview of the project structure for developers and AI agents working on this codebase.

## Project Overview

A single-page password generator that produces simple, child-friendly passwords. Built with TanStack Start and deployed on Netlify. There is no backend or database; generation runs entirely client-side. Access to the site is gated by Auth0, enforced in a Netlify Edge Function.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start |
| Frontend | React 19, TanStack Router v1 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 + custom CSS (`src/styles.css`) |
| Language | TypeScript 5.9 |
| Auth | Auth0 (Authorization Code + PKCE, enforced at the edge) |
| Deployment | Netlify |

## Directory Structure

```
├── netlify
│   └── edge-functions
│       └── auth.ts  # Auth0 login/callback/logout + session gate for every request.
├── public
│   ├── favicon.ico
│   └── tanstack-circle-logo.png
├── src
│   ├── components
│   │   ├── PasswordGenerator.tsx  # Password generation logic + the generator UI card.
│   │   └── UserMenu.tsx  # Signed-in chip; reads /auth/me, links to /auth/logout.
│   ├── routes
│   │   ├── __root.tsx  # Root layout: HTML shell, global styles, page title. No auth wrapper — the edge gate runs first.
│   │   └── index.tsx  # Home route: renders PasswordGenerator.
│   ├── router.tsx  # TanStack Router setup.
│   └── styles.css  # Tailwind import, font imports, and the app's playful visual theme.
├── netlify.toml  # Netlify deployment config: build command, publish directory, dev server settings.
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vite.config.ts
```

## Password Generation Rules

Implemented in `src/components/PasswordGenerator.tsx`:

- Format: three words, with two adjacent digits placed after the first, second, or third word, then one special character (e.g. `Jam95IceOnion*` or `JamIceOnion95*`).
- **All randomness must come from `crypto.getRandomValues()` via the `randomInt()` helper.** Never use `Math.random()` here — it is a predictable PRNG, and recovering its state from one shared password would expose the others generated in the same session. `randomInt()` uses rejection sampling, so do not replace it with a plain modulo.
- Words come from `WORDS`, a curated list restricted to child-friendly categories (food, colors, nature, toys, everyday objects). Do not add words outside those categories without re-reviewing for age-appropriateness.
- **No animal names.** All 29 of them (`Pig`, `Koala`, `Bunny`, `Tiger`, …) were removed at the site owner's request — animal words are simply not wanted here. Top the list up with food, nature or object words instead.
- **Words must read the same on both sides of the Atlantic.** American-only terms (`candy`, `truck`, `corn`, `taco`, `bagel`, `wagon`, `cabin`) were removed: a word the reader would never use themselves is a word they hesitate over when dictating it. Prefer the internationally neutral term, or the British one where the two differ (`lorry` over `truck`, `torch` over `flashlight`).
- **Words must also be unambiguous when read aloud over the phone.** Passwords here get dictated, so the list excludes homophones (`bear`/`bare`, `pear`/`pair`, `sun`/`son`), silent-letter spellings (`lamb`, `chalk`, `wren`), and words obscure enough to need spelling out (`quail`, `tart`, `mauve`). Prefer a word a stranger can write down first time over a word that merely looks friendly.
- **Every word must be 3–5 characters.** This is a correctness constraint, not style: three words plus two digits and a symbol have to fit the 12–16 character budget, and over-long candidates are discarded by `generatePassword()`. Adding longer words shrinks the keyspace instead of growing it.
- Special characters come from `SPECIAL_CHARS` — a set that is easy to say aloud (`! @ * ?`). `$`, `%`, `&` and `#` were removed because they are commonly misheard when dictated (`#` is variously called hash, pound, number sign or hashtag, so speaker and listener do not always agree on what was said). Shrinking this set further directly reduces entropy.
- Total length is constrained to 12–16 characters. `generatePassword()` retries candidates until one fits, then falls back to `SHORT_WORDS` (≤4 chars), any three of which fit by construction.
- The three words are always distinct.
- The password is generated in a `useEffect` after mount, never during SSR, so the server and client do not render different values and break hydration.

### Keyspace

The current list of 127 words yields 1,362,024 valid ordered word triples; with 100 digit pairs, 3 digit positions and 4 symbols that is **1,634,428,800 combinations (~30.6 bits)**. Any change to the word list, digit positions, symbol set, or length budget changes this number — recompute it rather than assuming.

Earlier revisions ran at ~34.1 bits (312 words, 8 symbols); trimming to phone-friendly words and dropping four symbols cost roughly 4 bits, a deliberate usability trade. Dropping the seven American-only terms cost a further 0.2 bits (163 words, ~30.1 bits), and removing all 29 animal words cost about 0.9 bits more (156 words, ~29.9 bits → 127 words, ~29.0 bits). Varying the digit position later recovered about 1.6 bits without making the passwords harder to dictate. If entropy needs to come back up further, add more easy-to-dictate 3-5 character non-animal words rather than restoring the removed symbols.

## Advanced Mode

The toggle in `PasswordGenerator` switches from the word-based generator to `generateAdvancedPassword(length)`, for people who need a password they will paste rather than say.

- Alphabet: A–Z, a–z, 0–9 and the **same** four symbols as simple mode (`! @ * ?`). Widening the symbol set here would make the two modes disagree about what a "special character" is for no real gain.
- Length is chosen by the user with a range slider, bounded by `ADVANCED_MIN_LENGTH` (10) and `ADVANCED_MAX_LENGTH` (24), defaulting to 16. `generateAdvancedPassword()` clamps its argument as well, so the bounds hold even if the slider is bypassed. The upper bound is deliberately modest: 48 characters was more than anyone here pastes into a real form, and it made the displayed password hard to read.
- One character of each class (upper, lower, digit, symbol) is seeded first so the result always satisfies site password rules, then the whole string is shuffled with a CSPRNG-driven Fisher-Yates pass. **Do not skip the shuffle**: without it the symbol always sits at a known index.
- All randomness goes through the same `randomInt()` helper — the `Math.random()` prohibition above applies here too.
- Entropy is roughly `6.04 × length` bits (66-character alphabet), i.e. ~60 bits at the minimum, ~97 at the default and ~145 at the maximum. Guaranteeing one character per class shaves a negligible amount off that ceiling.
- Changing the mode or the slider regenerates immediately, so the displayed password always matches the controls.

## Conventions

### Naming
- Components: PascalCase
- Routes: kebab-case files

### Styling
- Tailwind utility classes for layout primitives where convenient; the generator card's distinct look lives in named `pw-*` classes in `src/styles.css` (kept separate from Tailwind so the theme is easy to find and adjust as a unit).

### TypeScript
- Strict mode enabled

## Authentication

Sign-in is handled entirely by `netlify/edge-functions/auth.ts`, which runs on every path (`/*`).

- The login flow deliberately does **not** live in the React bundle. If it did, the bundle would have to be served to anonymous visitors, and signing in would only hide the UI rather than restrict access to it.
- Flow: `/auth/login` starts Authorization Code + PKCE → `/auth/callback` verifies `state`, exchanges the code, and stores the Auth0 ID token in an `HttpOnly` cookie → every later request re-verifies that token's RS256 signature against the tenant JWKS.
- No client secret is used or needed; the token endpoint is called with PKCE as a public client.
- Client code never sees the token. `UserMenu` reads display fields from `/auth/me`.
- `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` are read at runtime via `Netlify.env.get()` and are never inlined into the bundle.

**Auth0 dashboard requirements** — the site returns 401/redirect loops without these:
- Allowed Callback URLs must include `https://<site>/auth/callback`
- Allowed Logout URLs must include `https://<site>`

## Development Commands

```bash
pnpm dev      # Start dev server (port 3000)
pnpm build    # Production build
```
