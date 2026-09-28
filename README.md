# Simple Password Generator

A single-page password generator that produces simple, memorable, phone-friendly passwords. Simple mode combines two distinct words, one four-digit number and one special character, giving 11–15 characters in total.

## How it works

Click "New password" to generate either `Apple4826book!` or `Applebook4826!`: the number is randomly placed between the words or after both words, with the symbol always last. Only the first letter is capitalised. Leading zeros are preserved, so a number such as `0042` has four digits.

The curated 91-word vocabulary is unchanged. Small visual gaps separate both words, the number and symbol using the approved Atkinson Hyperlegible Mono font; these gaps are not space characters, and Copy uses the exact joined password.

All choices use the browser's cryptographic RNG (`crypto.getRandomValues`) with rejection sampling. There are 91 × 90 distinct ordered word pairs, 10,000 number strings, two number positions and three symbols: **491,400,000 possible passwords (~28.87 bits)**. Four digits compensate for the removed third word; keeping only two digits would reduce the pool to ~22.23 bits. This is a relative improvement over the previous simple format (~27.03 bits), not a claim of high-entropy strength. Advanced mode remains available for stronger random passwords, particularly for long-lived credentials.

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
