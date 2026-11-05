import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

// Auth0 credentials are deliberately absent from this file. The sign-in flow
// runs entirely in netlify/edge-functions/auth.ts, so no Auth0 identifier needs
// to be inlined into the client bundle.
const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      // Netlify publishes only the prerendered client output. This app has no
      // server loaders or functions, and the Auth0 edge gate protects every path.
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
