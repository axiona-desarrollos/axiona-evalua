// Expedientes por predio: el ciudadano envía su solicitud (sin PIN, con cupo por IP);
// la coordinación lee la cola y actualiza estados (con PIN). Netlify Blobs.
import { getStore } from '@netlify/blobs';
import { r, pinValido, leerJSON } from '../lib/comun.mjs';

const POR_IP_DIA = 12;
const ESTADOS = ['reportado', 'en_cola', 'asignado', 'evaluado', 'en_diseno', 'expediente', 'cerrado'];

function resumen(p) {
  return {
    id: p.id, ciudad: p.ciudad, origen: p.origen, estado: p.estado, creado: p.creado, actualizado: p.actualizado, version: p.version,
    ubicacion: { lat: p.ubicacion?.lat, lon: p.ubicacion?.lon, barrio: p.ubicacion?.barrio, direccion: p.ubicacion?.direccion },
    vivienda: p.vivienda, senales: p.senales, hogar: { personas: p.hogar?.personas, menores: p.hogar?.menores, mayores: p.hogar?.mayores, discapacidad: p.hogar?.discapacidad, gestantes: p.hogar?.gestantes },
    grietas: (p.grietas || []).map(g => ({ id: g.id, elemento: g.elemento, patron: g.patron, ultima: g.ultima && { anchoMm: g.ultima.anchoMm, categoria: g.ultima.categoria } })),
    inclinaciones: (p.inclinaciones || []).map(i => ({ deriva: i.deriva, razonLimite: i.razonLimite })),
    sismo: p.sismo, orientacion: p.orientacion && { nivel: p.orientacion.nivel }, evaluacionResumen: p.evaluacionResumen,
    nFotos: Array.isArray(p.fotos) ? p.fotos.length : 0, asignado: p.asignado || null,
  };
}

async function cupo(req) {
  const ip = req.headers.get('x-nf-client-connection-ip') || 'x';
  const st = getStore({ name: 'cupos-predios' }), k = `${new Date().toISOString().slice(0, 10)}/${ip}`;
  const n = (await st.get(k, { type: 'json' })) || 0;
  if (n >= POR_IP_DIA) return false;
  await st.setJSON(k, n + 1);
  return true;
}

export default async (req) => {
  const st = getStore({ name: 'predios', consistency: 'strong' });
  if (req.method === 'GET') {
    if (!pinValido(req)) return r({ error: 'pin' }, 401);
    const id = new URL(req.url).searchParams.get('id');
    if (id) { const p = await st.get(id, { type: 'json' }); return p ? r(p) : r({ error: 'no_existe' }, 404); }
    const idx = (await st.get('_indice', { type: 'json' })) || {};
    return r({ predios: Object.values(idx), fecha: new Date().toISOString() });
  }
  if (req.method === 'POST') {
    let d; try { d = await leerJSON(req, 12_000_000); } catch (e) { return r({ error: e.message }, e.status || 400); }
    const p = d.predio;
    if (!p || typeof p.id !== 'string' || !/^[QP]-26-[A-Z0-9]{3,8}$/.test(p.id) || !['quibdo', 'pereira'].includes(p.ciudad)) return r({ error: 'datos' }, 400);
    if (!p.contacto?.consentimiento) return r({ error: 'consentimiento', mensaje: 'Falta la autorización de tratamiento de datos.' }, 400);
    const esPro = pinValido(req);
    if (!esPro && !(await cupo(req))) return r({ error: 'cupo', mensaje: 'Demasiadas solicitudes desde esta conexión hoy.' }, 429);
    const previo = await st.get(p.id, { type: 'json' });
    if (previo && (previo.version || 0) > (p.version || 0)) return r({ ok: true, id: p.id, ya: true, estado: previo.estado });
    const guardado = { ...p, estado: previo?.estado && previo.estado !== 'reportado' ? previo.estado : (p.estado === 'borrador' ? 'reportado' : p.estado || 'reportado'), recibido: previo?.recibido || new Date().toISOString(), asignado: previo?.asignado || null };
    await st.setJSON(p.id, guardado);
    const idx = (await st.get('_indice', { type: 'json' })) || {};
    idx[p.id] = resumen(guardado);
    await st.setJSON('_indice', idx);
    return r({ ok: true, id: p.id, estado: guardado.estado, recibido: guardado.recibido });
  }
  if (req.method === 'PATCH') {
    if (!pinValido(req)) return r({ error: 'pin' }, 401);
    let d; try { d = await leerJSON(req, 200_000); } catch (e) { return r({ error: e.message }, e.status || 400); }
    const p = await st.get(String(d.id || ''), { type: 'json' });
    if (!p) return r({ error: 'no_existe' }, 404);
    const c = d.cambios || {};
    if (c.estado && ESTADOS.includes(c.estado)) p.estado = c.estado;
    if (typeof c.asignado === 'string') p.asignado = c.asignado.slice(0, 120);
    p.historial = [...(p.historial || []), { fecha: new Date().toISOString(), evento: `Coordinación: ${c.estado ? 'estado ' + c.estado : ''}${c.asignado ? ' asignado a ' + c.asignado : ''}`.trim(), por: 'coordinacion' }];
    p.version = (p.version || 0) + 1;
    await st.setJSON(p.id, p);
    const idx = (await st.get('_indice', { type: 'json' })) || {};
    idx[p.id] = resumen(p);
    await st.setJSON('_indice', idx);
    return r({ ok: true, predio: resumen(p) });
  }
  return r({ error: 'método' }, 405);
};
export const config = { path: '/api/predios' };
