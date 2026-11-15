/* AXIONA EVALÚA · Service worker: la app abre y funciona sin señal.
   - Navegación: red primero; sin señal, la última versión guardada.
   - /assets/* (con hash): caché primero.
   - /mapa/*.pmtiles: si el mapa de la ciudad se descargó, responde las peticiones
     por rangos (Range) desde el teléfono; si no, va a la red.
   - /mapa/fuentes, /mapa/sprites, /sismo/*: caché con actualización en segundo plano.
   - /obra/ y /topo/ tienen su propio service worker; /api/ siempre va a la red. */
const VERSION = 'evalua-v2.0.0';
const APP = `app-${VERSION}`, MAPAS = 'axiona-mapas-v1';
const BASE = ['/', '/index.html', '/manifest.webmanifest', '/icono-192.png', '/icono-512.png', '/puente.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(BASE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('app-') && k !== APP).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function porRango(req, cache) {
  const entero = await cache.match(new URL(req.url).pathname);
  if (!entero) return null;
  const rango = req.headers.get('range');
  if (!rango) return entero;
  const m = /bytes=(\d+)-(\d*)/.exec(rango);
  if (!m) return entero;
  const buf = await entero.arrayBuffer();
  const ini = +m[1], fin = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(ini, fin + 1), { status: 206, headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${ini}-${fin}/${buf.byteLength}`, 'Content-Length': String(fin - ini + 1), 'Accept-Ranges': 'bytes' } });
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const p = url.pathname;
  if (p.startsWith('/api/') || p.startsWith('/obra/') || p.startsWith('/topo/') || p.startsWith('/__candado')) return;

  if (p.endsWith('.pmtiles')) {
    e.respondWith(caches.open(MAPAS).then(c => porRango(req, c)).then(r => r || fetch(req)));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copia = r.clone(); caches.open(APP).then(c => c.put('/index.html', copia)); } return r; })
      .catch(() => caches.match('/index.html').then(r => r || caches.match('/'))));
    return;
  }
  if (p.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(x => { if (x.ok) { const copia = x.clone(); caches.open(APP).then(c => c.put(req, copia)); } return x; })));
    return;
  }
  if (p.startsWith('/mapa/') || p.startsWith('/sismo/') || /\.(png|svg|webmanifest|js)$/.test(p)) {
    e.respondWith((async () => {
      const guardada = (await caches.match(req)) || (await caches.open(MAPAS).then(c => c.match(p)));
      const red = fetch(req).then(x => { if (x.ok && x.status === 200) { const copia = x.clone(); caches.open(APP).then(c => c.put(req, copia)); } return x; }).catch(() => null);
      return guardada || (await red) || new Response('', { status: 504 });
    })());
  }
});
