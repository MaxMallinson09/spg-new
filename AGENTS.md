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
│   │   ├── PasswordGenerator.tsx  # Generator UI card.
│   │   ├── PasswordText.tsx  # Visual password parts, without space characters.
│   │   └── UserMenu.tsx  # Signed-in chip; reads /auth/me, links to /auth/logout.
│   ├── lib/passwords.ts  # Pure generation functions and vocabulary.
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

Implemented in `src/lib/passwords.ts`; UI in `src/components/PasswordGenerator.tsx`:

- Format: two distinct words, a uniformly random three-digit string placed between them or after both words, then one symbol (e.g. `Apple482book!` or `Applebook482!`). Only the first letter is capitalised. Retain leading zeros.
- **All randomness must come from `crypto.getRandomValues()` via the `randomInt()` helper.** Never use `Math.random()` here — it is a predictable PRNG, and recovering its state from one shared password would expose the others generated in the same session. `randomInt()` uses rejection sampling, so do not replace it with a plain modulo.
- Words come from `WORDS`, a curated list of neutral, familiar 3–5 character terms that are suitable for professional phone use. New entries need a phone-readability review, not just a content-safety review.
- **No animal names.** All 29 of them (`Pig`, `Koala`, `Bunny`, `Tiger`, …) were removed at the site owner's request — animal words are simply not wanted here. Top the list up with neutral food, nature, object, place, or simple technical words instead.
- **Words must read the same on both sides of the Atlantic.** American-only terms (`candy`, `truck`, `corn`, `taco`, `bagel`, `wagon`, `cabin`) were removed: a word the reader would never use themselves is a word they hesitate over when dictating it. Prefer internationally neutral wording.
- **Words must be unambiguous when read aloud over the phone.** Exclude exact homophones (`ball`/`bawl`, `bean`/`been`, `ice`/`eyes`, `ring`/`wring`, `rose`/`rows`, `shoe`/`shoo`, `wave`/`waive`), silent-letter spellings, and obscure words. Also exclude terms such as `beach`, `peach`, `ship`, and `fork` when a poor line could turn them into an embarrassing or unprofessional-sounding word. Prefer a word a stranger can write down first time over a word that merely looks friendly.
- **Keep the list professionally neutral.** Avoid profanity, slurs, sexual or bodily terms, insults, crime/drug/violence terms, human descriptors with social baggage, slang/innuendo, and childish or patronising wording.
- **Every word must be 3–5 characters.** Two words plus three digits and one symbol give 10–14 characters by construction, so no length rejection or short-word fallback is needed.
- Special characters are `!`, `*`, `?` in both modes. `@`, `$`, `%`, `&` and `#` remain excluded.
- Draw the second word uniformly from the remaining indices; never allow the same word twice.
- `generateSimplePassword()` returns the raw `password` plus ordered `parts` for display. Keep word boundaries in this metadata even when the words are adjacent; do not infer them from the concatenated string.
- `PasswordText` validates that parts join to the raw password. CSS margins add visual gaps only. Copy always uses the raw string, without added spaces. Preserve the approved Atkinson Hyperlegible Mono font.
- The password is generated in a `useEffect` after mount, never during SSR, so the server and client do not render different values and break hydration.

### Keyspace

The current list has **91 words**. All **8,190 ordered distinct word pairs** are valid and yield unique strings in each layout. With 1,000 three-digit strings, two number positions and three symbols, this gives **49,140,000 combinations (~25.55 bits)**. The tests enumerate every pair and both positions to check for collisions. Recalculate whenever the vocabulary or format changes.

Max explicitly requested three digits and version 3.3.0. This reduces the proposed four-digit keyspace (491,400,000 combinations, ~28.87 bits) tenfold. It also falls below the preceding three-word release (137,493,000 combinations, ~27.03 bits). Document this usability/security tradeoff; do not claim that three digits preserve the previous strength. Advanced mode remains available for stronger random passwords.

## Advanced Mode

The toggle in `PasswordGenerator` switches from the word-based generator to `generateAdvancedPassword(length)`, for people who need a password they will paste rather than say.

- Alphabet: A–Z, a–z, 0–9 and the **same** three symbols as simple mode (`! * ?`). Widening the symbol set here would make the two modes disagree about what a "special character" is for no real gain.
- Length is chosen by the user with a range slider, bounded by `ADVANCED_MIN_LENGTH` (10) and `ADVANCED_MAX_LENGTH` (24), defaulting to 16. `generateAdvancedPassword()` clamps its argument as well, so the bounds hold even if the slider is bypassed. The upper bound is deliberately modest: 48 characters was more than anyone here pastes into a real form, and it made the displayed password hard to read.
- One character of each class (upper, lower, digit, symbol) is seeded first so the result always satisfies site password rules, then the whole string is shuffled with a CSPRNG-driven Fisher-Yates pass. **Do not skip the shuffle**: without it the symbol always sits at a known index.
- All randomness goes through the same `randomInt()` helper — the `Math.random()` prohibition above applies here too.
- Entropy is at most `6.02 × length` bits (65-character alphabet), i.e. ~60 bits at the minimum, ~96 at the default and ~145 at the maximum. The seeded-and-shuffled generator is not uniform over all alphabet strings, so these are upper bounds rather than exact entropy values.
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
pnpm test     # Generation and display regression tests
```

## Release versions

Include a package.json version bump with each new release. Changes added to the same unreleased PR share its existing version; do not deploy solely to change a version number.
