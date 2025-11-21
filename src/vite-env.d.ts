/// <reference types="vite/client" />


// Esta interfaz global asegura que 'env' esté presente en 'ImportMeta'.
interface ImportMeta {
  readonly env: ImportMetaEnv;
}