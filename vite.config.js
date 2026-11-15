import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
// Axiona Obra (y su motor de visión de marcadores) se usa tal cual desde su repositorio:
// OBRA_DIR apunta a la copia local; por defecto, la carpeta hermana ../axiona-obra.
const OBRA = resolve(process.env.OBRA_DIR || resolve(AQUI, '../axiona-obra'));
if (!existsSync(resolve(OBRA, 'src/ar/vision/detector.js'))) {
  throw new Error(`No se encontró Axiona Obra en ${OBRA}. Clone axiona-desarrollos/axiona-obra junto a este repositorio o defina OBRA_DIR.`);
}

export default defineConfig({
  root: AQUI,
  base: '/',
  resolve: { alias: { '@obra-vision': resolve(OBRA, 'src/ar/vision') } },
  server: { port: 8170, fs: { allow: [AQUI, OBRA] } },
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 1200, rollupOptions: { output: { manualChunks: { maplibre: ['maplibre-gl'] } } } },
  test: { exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'] },
});
