import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import '../styles.css'
import '../light-theme.css'
import '../dark-theme.css'
import '../themes.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Simple Password Generator',
      },
    ],
    links: [
      // The existing stylesheet imports Inter from Google Fonts. Preconnecting
      // avoids making the browser wait for DNS/TLS only after it discovers that
      // CSS import. This changes no CSP or authentication behaviour.
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      // Declared explicitly rather than relying on the browser's implicit
      // /favicon.ico probe, so the icon is requested on the first paint.
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // No auth wrapper here on purpose: netlify/edge-functions/auth.ts refuses to
  // serve this document at all without a valid session, so anything that
  // reaches the browser is already behind the gate.
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
