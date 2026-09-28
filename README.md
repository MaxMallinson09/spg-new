# Simple Password Generator

A single-page password generator that produces simple, memorable, phone-friendly passwords. Simple mode combines two distinct words, one three-digit number and one special character, giving 10–14 characters in total.

## How it works

Click "New password" to generate either `Apple482book!` or `Applebook482!`: the number is randomly placed between the words or after both words, with the symbol always last. Only the first letter is capitalised. Leading zeros are preserved, so a number such as `042` has three digits.

The curated 91-word vocabulary is unchanged. Small visual gaps separate both words, the number and symbol using the approved Atkinson Hyperlegible Mono font; these gaps are not space characters, and Copy uses the exact joined password.

All choices use the browser's cryptographic RNG (`crypto.getRandomValues`) with rejection sampling. There are 91 × 90 distinct ordered word pairs, 1,000 number strings, two number positions and three symbols: **49,140,000 possible passwords (~25.55 bits)**. Three digits were explicitly requested for v3.3.0. This gives ten times fewer combinations than the proposed four-digit format (~28.87 bits), and fewer than the preceding three-word release (~27.03 bits). Advanced mode remains available for stronger random passwords, particularly for long-lived credentials.

The site is private: every request passes through an Auth0 sign-in check before any page or script is served.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19 + TanStack Router)
- Vite 7
- Tailwind CSS 4, with custom CSS for the visual theme
- Auth0 for sign-in, enforced in a Netlify Edge Function
- Deployed on Netlify

## Running locally

```bash
pnpm install
pnpm dev
```

The dev server runs at `http://localhost:3000`. Use `netlify dev` (port 8888) to exercise the Auth0 edge gate, which needs `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` in the environment; plain `pnpm dev` does not run edge functions.

## Project structure

- `src/components/PasswordGenerator.tsx` — generator UI
- `src/lib/passwords.ts` — cryptographic password generation and vocabulary
- `src/components/PasswordText.tsx` — visual grouping without space characters
- `src/routes/index.tsx` — home page, renders the generator
- `src/styles.css` — global styles and theme
- `netlify/edge-functions/auth.ts` — Auth0 login/callback/logout and the session gate
