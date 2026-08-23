import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

// Auth0 credentials are deliberately absent from this file. The sign-in flow
// runs entirely in netlify/edge-functions/auth.ts, so no Auth0 identifier needs
// to be inlined into the client bundle.
const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    netlify(),
    tanstackStart({
      // This app has one static page and no server-side loader data. Generate
      // the root HTML at build time so Netlify can serve it directly from the
      // CDN instead of invoking the TanStack Start server handler for `/`.
      // The Auth0 edge function still runs on `/*`, so this does not weaken the
      // authentication boundary or expose the page to signed-out visitors.
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
        failOnError: true,
      },
    }),
    viteReact(),
  ],
})

export default config
