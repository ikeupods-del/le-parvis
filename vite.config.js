import { defineConfig } from 'vite';

// base './' : les liens restent relatifs, le site marche quel que soit le nom
// du dépôt GitHub ou le domaine final.
export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
});
