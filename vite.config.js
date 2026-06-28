import { defineConfig } from 'vite';

// GitHub Pages serverer projektet under /calisthenics-rig-designer/, så
// 'base' SKAL sættes, ellers peger aktiv-URL'er forkert og siden bliver blank.
export default defineConfig({
  base: '/calisthenics-rig-designer/',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
