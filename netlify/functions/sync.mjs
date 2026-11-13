// Sincronización: guarda las evaluaciones en Netlify Blobs y entrega el consolidado al tablero.
// POST { evaluaciones: [...] } → guarda (la versión más nueva gana). GET → lista sin fotos ni firma.
import { getStore } from '@netlify/blobs';
import { r, pinValido, leerJSON } from '../lib/comun.mjs';

const resumen = e => { const { fotos, firma, ...resto } = e; return { ...resto, nFotos: Object.values(fotos || {}).filter(Boolean).length }; };

export default async (req) => {
  if (!pinValido(req)) return r({ error: 'pin' }, 401);
  const st = getStore({ name: 'evaluaciones', consistency: 'strong' });
  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id');
    if (id) { const e = await st.get(id, { type: 'json' }); return e ? r(e) : r({ error: 'no_existe' }, 404); }
    const idx = (await st.get('_indice', { type: 'json' })) || {};
    return r({ evaluaciones: Object.values(idx), fecha: new Date().toISOString() });
  }
  if (req.method !== 'POST') return r({ error: 'método' }, 405);
  let d; try { d = await leerJSON(req, 25_000_000); } catch (e) { return r({ error: e.message }, e.status || 400); }
  const lista = (Array.isArray(d.evaluaciones) ? d.evaluaciones : []).filter(e => e && typeof e.id === 'string' && /^EV-[\w-]{3,80}$/.test(e.id)).slice(0, 50);
  const idx = (await st.get('_indice', { type: 'json' })) || {};
  const aceptadas = [];
  for (const e of lista) {
    const previa = idx[e.id];
    if (previa && (previa.version || 0) > (e.version || 0)) continue; // ya hay una versión más nueva
    await st.setJSON(e.id, e);
    idx[e.id] = resumen(e);
    aceptadas.push(e.id);
  }
  await st.setJSON('_indice', idx);
  return r({ subidas: aceptadas.length, ids: aceptadas });
};
export const config = { path: '/api/sync' };
