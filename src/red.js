/* ==========================================================================
   AXIONA EVALÚA · Servidor: Agente Axiona y sincronización
   ========================================================================== */
import { preclasificar } from './reglas.js';

let pin = '';
export const ponerPin = p => { pin = p; };
const cab = () => ({ 'Content-Type': 'application/json', 'x-acceso': pin });

/** Consulta al Agente Axiona (Claude). Sin conexión o si falla, usa las reglas de respaldo. */
export async function consultarAgente(ev) {
  if (!navigator.onLine) return { ...preclasificar(ev), aviso: 'Sin conexión: sugerencia por reglas. Cuando vuelva la señal, pide de nuevo la revisión del Agente Axiona.' };
  try {
    const fotos = Object.entries(ev.fotos || {}).filter(([, v]) => v).slice(0, 6).map(([k, v]) => ({ id: k, data: v }));
    const { fotos: _, firma, ...resto } = ev;
    const r = await fetch('/api/agente', { method: 'POST', headers: cab(), body: JSON.stringify({ evaluacion: resto, fotos }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.mensaje || d.error || `Error ${r.status}`);
    return d;
  } catch (e) {
    return { ...preclasificar(ev), aviso: `El Agente Axiona no respondió (${e.message}). Sugerencia por reglas.` };
  }
}

/** Sube las evaluaciones firmadas o revisadas que no se han sincronizado. */
export async function subir(evs) {
  if (!navigator.onLine || !evs.length) return { subidas: 0 };
  const r = await fetch('/api/sync', { method: 'POST', headers: cab(), body: JSON.stringify({ evaluaciones: evs }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.mensaje || d.error || `Error ${r.status}`);
  return d;
}

/** Trae el consolidado del servidor (sin fotos) para el tablero. */
export async function bajar() {
  if (!navigator.onLine) return null;
  const r = await fetch('/api/sync', { headers: cab() });
  if (!r.ok) return null;
  return r.json();
}

export async function verificarPin(p) {
  try {
    const r = await fetch('/api/acceso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: p }) });
    if (r.status === 404) return true; // sin servidor (desarrollo local)
    return r.ok;
  } catch { return !navigator.onLine; } // sin señal: se valida con el pin guardado
}
