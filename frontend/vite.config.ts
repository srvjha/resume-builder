import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // Vercel runs functions in Washington DC by default; users and the API are in Mumbai.
    nitro({ vercel: { functions: { regions: ['bom1'] } } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
