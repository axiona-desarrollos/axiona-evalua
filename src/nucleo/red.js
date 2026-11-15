/* ==========================================================================
   AXIONA EVALÚA · Servidor: solicitudes, cola, Agente Axiona, derechos y sismo
   ========================================================================== */
import { preclasificar } from '../evaluacion/reglas.js';

let pin = '';
export const ponerPin = p => { pin = p || ''; };
export const tienePin = () => !!pin;
const cab = () => ({ 'Content-Type': 'application/json', 'x-acceso': pin });

async function pedir(url, op = {}) {
  const r = await fetch(url, op);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.mensaje || d.error || `Error ${r.status}`); e.status = r.status; throw e; }
  return d;
}

/** El ciudadano envía su solicitud (expediente completo con fotos reducidas). */
export async function enviarSolicitud(pr) {
  return pedir('/api/predios', { method: 'POST', headers: cab(), body: JSON.stringify({ predio: pr }) });
}
/** Profesional: la cola consolidada (sin fotos) y un expediente completo. */
export const cola = () => pedir('/api/predios', { headers: cab() });
export const predioRemoto = id => pedir(`/api/predios?id=${encodeURIComponent(id)}`, { headers: cab() });
export const actualizarRemoto = (id, cambios) => pedir('/api/predios', { method: 'PATCH', headers: cab(), body: JSON.stringify({ id, cambios }) });

/** Agente Axiona (Claude) para la evaluación de fase 1; sin señal, reglas de respaldo. */
export async function consultarAgente(ev) {
  if (!navigator.onLine) return { ...preclasificar(ev), aviso: 'Sin conexión: sugerencia por reglas. Cuando vuelva la señal, pida de nuevo la revisión del Agente Axiona.' };
  try {
    const fotos = Object.entries(ev.fotos || {}).filter(([, v]) => v).slice(0, 6).map(([k, v]) => ({ id: k, data: v }));
    const { fotos: _f, firma: _s, ...resto } = ev;
    return await pedir('/api/agente', { method: 'POST', headers: cab(), body: JSON.stringify({ evaluacion: resto, fotos }) });
  } catch (e) {
    return { ...preclasificar(ev), aviso: `El Agente Axiona no respondió (${e.message}). Sugerencia por reglas.` };
  }
}
export const subirEvaluaciones = evs => pedir('/api/sync', { method: 'POST', headers: cab(), body: JSON.stringify({ evaluaciones: evs }) });

export async function verificarPin(p) {
  try {
    const r = await fetch('/api/acceso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: p }) });
    if (r.status === 404) return true; // desarrollo local sin funciones
    return r.ok;
  } catch { return !navigator.onLine; }
}

/** Pregunta abierta a «Mis derechos» (Claude con citas al corpus). */
export const preguntarDerechos = (pregunta, contexto) => pedir('/api/derechos', { method: 'POST', headers: cab(), body: JSON.stringify({ pregunta, contexto }) });

/** Sismos recientes (SGC con respaldo USGS) normalizados por el servidor. */
export async function sismosRecientes() {
  try { const d = await pedir('/api/sismos'); return Array.isArray(d?.eventos) ? d : null; } catch { return null; }
}
