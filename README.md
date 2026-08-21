# Simple Password Generator

A single-page password generator that produces simple, memorable, kid-safe passwords. Every password combines three easy-to-read words, two numbers, and one special character, and always lands between 12 and 16 characters long.

## How it works

Click "New password" to generate a fresh password in the format `WordWordWordNN!` (for example `NewtHutKey28$`). Words are pulled from a curated, child-friendly list (animals, food, colors, nature, toys — no scary or inappropriate words). Click "Copy" to copy the current password to your clipboard.

Randomness comes from the browser's cryptographic RNG (`crypto.getRandomValues`), and the word list is sized so that a generated password is one of roughly 18 billion possibilities.

The site is private: every request passes through an Auth0 sign-in check before any page or script is served.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19 + TanStack Router)
- Vite 7
- Tailwind CSS 4, with custom CSS for the playful visual theme
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
