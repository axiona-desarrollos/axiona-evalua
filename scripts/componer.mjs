#!/usr/bin/env node
/* AXIONA EVALÚA · Compone el sitio completo:
   1. compila esta app (dist/);
   2. compila Axiona Obra en dist/obra/ y Axiona Topo en dist/topo/ desde su repositorio
      (OBRA_DIR, por defecto ../axiona-obra) y les inserta el puente (/puente.js);
   3. copia las funciones de Obra (lectura de bocetos y DWG) a netlify/functions/obra-*.mjs.
   Uso: npm run build:todo                                                                  */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OBRA = resolve(process.env.OBRA_DIR || resolve(RAIZ, '../axiona-obra'));
const sh = (c, cwd = RAIZ) => { console.log(`\n$ ${c}  (${cwd})`); execSync(c, { cwd, stdio: 'inherit' }); };
if (!existsSync(resolve(OBRA, 'package.json'))) throw new Error(`No está Axiona Obra en ${OBRA} (defina OBRA_DIR).`);

sh('npx vite build');
if (!existsSync(resolve(OBRA, 'node_modules'))) sh('npm ci', OBRA);
sh(`npx vite build --base=/obra/ --outDir ${resolve(RAIZ, 'dist/obra')} --emptyOutDir`, OBRA);
const TOPO = resolve(OBRA, 'topo');
if (!existsSync(resolve(TOPO, 'node_modules'))) sh('npm ci', TOPO);
sh(`npx vite build --base=/topo/ --outDir ${resolve(RAIZ, 'dist/topo')} --emptyOutDir`, TOPO);

// el puente y una sola app instalable: Obra y Topo no ofrecen instalarse por separado aquí
for (const sub of ['obra', 'topo']) {
  const f = resolve(RAIZ, `dist/${sub}/index.html`);
  let h = readFileSync(f, 'utf8');
  if (!h.includes('/puente.js')) h = h.replace('</head>', '<script src="/puente.js"></script>\n</head>');
  h = h.replace(/<link rel="manifest"[^>]*>\s*/g, '');
  // Radar: dentro de Evalúa, Obra y Topo cuentan como visitas de Evalúa (no de obra.axionasoft.com)
  const RADAR = '<script defer src="https://axiona-radar.netlify.app/r.js" data-sitio="evalua"></script>';
  if (/axiona-radar\.netlify\.app\/r\.js/.test(h)) h = h.replace(/data-sitio="[^"]*"/, 'data-sitio="evalua"');
  else h = h.replace('</head>', `${RADAR}\n</head>`);
  h = h.replace(/<meta name="robots"[^>]*>/g, '').replace('<head>', '<head>\n<meta name="robots" content="noindex, nofollow">');
  writeFileSync(f, h);
}
// funciones de Obra (bocetos con Claude y DWG con LibreDWG)
mkdirSync(resolve(RAIZ, 'netlify/bin'), { recursive: true });
copyFileSync(resolve(OBRA, 'netlify/functions/boceto.mjs'), resolve(RAIZ, 'netlify/functions/obra-boceto.mjs'));
copyFileSync(resolve(OBRA, 'netlify/functions/dwg.mjs'), resolve(RAIZ, 'netlify/functions/obra-dwg.mjs'));
copyFileSync(resolve(OBRA, 'netlify/bin/dxf2dwg'), resolve(RAIZ, 'netlify/bin/dxf2dwg'));
rmSync(resolve(RAIZ, 'dist/obra/medios'), { recursive: true, force: true });
console.log('\nListo: dist/ con la app, /obra/ y /topo/.');
