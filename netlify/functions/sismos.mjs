// Sismos recientes cerca de Quibdó y Pereira. Fuente oficial: SGC (feed JSON); respaldo: USGS (FDSN).
// Se normaliza a una lista común y se cachea 5 minutos en la CDN de Netlify.
const SGC = 'https://archive.sgc.gov.co/feed/v1.0.1/summary/five_days_all.json';
const CENTRO = { lat: 5.25, lon: -76.2 }, RADIO_KM = 260;
const DESDE = '2026-08-10T00:00:00';

const r = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
});

function normalizar(f, fuente) {
  const p = f.properties || {}, [lon, lat, prof] = f.geometry?.coordinates || [];
  return { id: f.id || p.code || `${p.time}`, mag: p.mag ?? p.magnitude, tipoMag: p.magType || '', hora: typeof p.time === 'number' ? p.time : Date.parse(p.time || p.utcTime || ''), lat, lon, profundidadKm: prof, lugar: p.place || p.title || '', fuente, url: p.url || '' };
}
const dist = (a, b) => { const R = 6371, t = Math.PI / 180, dφ = (b.lat - a.lat) * t, dλ = (b.lon - a.lon) * t; const s = Math.sin(dφ / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dλ / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };

async function json(url) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
  try { const x = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'axiona-evalua/1.0', Accept: 'application/json' } }); if (!x.ok) throw new Error(String(x.status)); return await x.json(); } finally { clearTimeout(t); }
}

export default async () => {
  const fuentes = [], eventos = [];
  try {
    const d = await json(SGC);
    for (const f of d.features || []) { const e = normalizar(f, 'SGC'); if (e.lat && dist(CENTRO, e) <= RADIO_KM) eventos.push(e); }
    fuentes.push({ id: 'SGC', ok: true });
  } catch (e) { fuentes.push({ id: 'SGC', ok: false, error: String(e.message || e).slice(0, 80) }); }
  try {
    const q = new URLSearchParams({ format: 'geojson', starttime: DESDE, latitude: CENTRO.lat, longitude: CENTRO.lon, maxradiuskm: RADIO_KM, minmagnitude: 2.5, orderby: 'time', limit: 300 });
    const d = await json(`https://earthquake.usgs.gov/fdsnws/event/1/query?${q}`);
    for (const f of d.features || []) eventos.push(normalizar(f, 'USGS'));
    fuentes.push({ id: 'USGS', ok: true });
  } catch (e) { fuentes.push({ id: 'USGS', ok: false, error: String(e.message || e).slice(0, 80) }); }
  // sin duplicados entre agencias: mismo minuto y < 30 km → se queda el del SGC
  const vistos = [];
  const lista = eventos.sort((a, b) => (a.fuente === 'SGC' ? -1 : 1) - (b.fuente === 'SGC' ? -1 : 1)).filter(e => {
    if (vistos.some(v => Math.abs(v.hora - e.hora) < 90000 && dist(v, e) < 30)) return false;
    vistos.push(e); return true;
  }).sort((a, b) => b.hora - a.hora);
  return r({ eventos: lista.slice(0, 200), fuentes, fecha: new Date().toISOString() });
};
export const config = { path: '/api/sismos' };
