import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Custom domain deployment (fredrichegland.no): use root base so assets resolve at domain root
  base: '/',
})
