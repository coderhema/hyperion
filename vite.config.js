import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  },
  preview: {
    // Quick-tunnel domains (trycloudflare.com) change every run - don't
    // pin hostnames, otherwise vite preview serves 403 to the tunnel.
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
