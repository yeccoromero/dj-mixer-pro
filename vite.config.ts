import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // Tone.js (the app's single heaviest dependency) is dynamically imported in
    // lib/effectSounds.ts and already splits into its own ~340kB chunk, downloaded only once
    // someone actually holds down an FX pad. What's left in the main chunk — GSAP, Framer
    // Motion, Radix UI, React — is needed for the always-visible UI (faders, crossfader,
    // deck animations) at first paint, so there's no further win from chasing this warning
    // down to the default 500kB; raised just enough to stop flagging that expected chunk.
    chunkSizeWarningLimit: 600,
  },
})
