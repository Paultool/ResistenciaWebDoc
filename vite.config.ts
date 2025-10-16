import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Esto ahora será reconocido como una propiedad válida
  // --- AÑADE ESTA SECCIÓN ---
  optimizeDeps: {
    include: [
      'three', // Incluir la librería base
      // Incluir todos los módulos 'examples/jsm' que uses, sin los cuales el error persiste:
      'three/examples/jsm/controls/DeviceOrientationControls',
      'three/examples/jsm/controls/PointerLockControls',
      'three/examples/jsm/loaders/GLTFLoader',
      // Añade aquí cualquier otro módulo de three/examples/jsm que no se esté cargando.
    ],
  },
  // -------------------------
});