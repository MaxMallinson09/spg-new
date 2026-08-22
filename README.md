# Simple Password Generator

A single-page password generator that produces simple, memorable, phone-friendly passwords. Every simple-mode password combines three easy-to-dictate words, two numbers, and one special character, and always lands between 12 and 16 characters long.

## How it works

Click "New password" to generate a fresh password in the format `WordWordWordNN!` (for example `MangoDesk27Plum!`). Words come from a curated 147-word list of neutral, familiar terms chosen to be easy to hear and write down over the phone. The list deliberately avoids animal names, exact homophones, silent-letter spellings, obscure words, awkward or offensive terms, and words that can sound embarrassing on a poor line.

Randomness comes from the browser's cryptographic RNG (`crypto.getRandomValues`). The current simple-mode keyspace contains 2,577,096,000 valid combinations (about 31.3 bits) after the 12–16 character length rule is applied.

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

- `src/components/PasswordGenerator.tsx` — password generation logic and UI
- `src/routes/index.tsx` — home page, renders the generator
- `src/styles.css` — global styles and theme
- `netlify/edge-functions/auth.ts` — Auth0 login/callback/logout and the session gate
