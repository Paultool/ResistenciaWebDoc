import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // ✨ CAMBIO CLAVE: Usar ruta relativa.
  // Esto genera rutas como './assets/...' que siempre buscan los archivos 
  // relativos al HTML donde se cargan.
  base: './', 
  
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
})