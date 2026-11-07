import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// La app principal mantiene Firebase original. importar.html carga Firebase nuevo en una instancia aislada.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        importar: fileURLToPath(new URL('./importar.html', import.meta.url)),
      },
    },
  },
})
