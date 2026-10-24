import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Base relativa: o build funciona em qualquer subdiretório do GitHub Pages
// (https://usuario.github.io/<repositorio>/) sem precisar saber o nome do repositório.
// Para um caminho absoluto, defina BASE_PATH=/nome-do-repo/ no build.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
