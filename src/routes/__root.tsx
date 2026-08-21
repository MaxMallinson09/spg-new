import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import '../styles.css'

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
    // Declared explicitly rather than relying on the browser's implicit
    // /favicon.ico probe, so the icon is requested on the first paint.
    links: [
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
