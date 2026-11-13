/* AXIONA EVALÚA · service worker: la app abre y funciona sin internet.
   - index.html: red primero (para recibir versiones nuevas) y copia de respaldo.
   - Código, fuentes e íconos: caché primero (los .js llevan hash).
   - Mapa: guarda las teselas que ya se vieron, con tope, para usarlas sin señal.
   - /api/*: nunca se guarda en caché. */
const VERSION = 'evalua-v1';
const MAPA = 'evalua-mapa-v1', TOPE_MAPA = 1500;
const BASICOS = ['./', './index.html', './manifest.webmanifest', './icono-192.png', './icono-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![VERSION, MAPA].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function recortar() {
  const c = await caches.open(MAPA), ks = await c.keys();
  for (let i = 0; i < ks.length - TOPE_MAPA; i++) await c.delete(ks[i]);
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(caches.open(MAPA).then(async c => {
      const g = await c.match(req);
      if (g) return g;
      try { const r = await fetch(req); if (r.ok) { c.put(req, r.clone()); recortar(); } return r; } catch { return new Response('', { status: 504 }); }
    }));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const k = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', k)); return r; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  if (url.origin === location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')) {
    e.respondWith(caches.match(req).then(g => g || fetch(req).then(r => { if (r.ok) { const k = r.clone(); caches.open(VERSION).then(c => c.put(req, k)); } return r; })));
  }
});
