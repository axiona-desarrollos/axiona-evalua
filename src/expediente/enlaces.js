/* ==========================================================================
   AXIONA EVALÚA · Abrir Axiona Topo y Axiona Obra con el predio ya cargado
   --------------------------------------------------------------------------
   Topo y Obra viven en el mismo sitio (/topo/ y /obra/). Antes de abrirlas se
   deja el contexto del predio (sessionStorage) y su propio estado guardado,
   para que cada predio tenga su levantamiento y su diseño sin mezclarse.
   ========================================================================== */
import { CIUDADES } from '../nucleo/ciudades.js';

const aB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
/** Enlace de Obra con el proyecto embebido (#p=j + JSON en base64url), el formato que Obra lee. */
export const enlaceObra = S => `/obra/#p=j${aB64(new TextEncoder().encode(JSON.stringify(S)))}`;

function contexto(pr) {
  try { sessionStorage.setItem('axiona-predio', JSON.stringify({ id: pr.id, direccion: pr.ubicacion.direccion || pr.id, ciudad: pr.ciudad })); } catch { /* */ }
}

export function abrirTopo(pr) {
  contexto(pr);
  try {
    if (pr.topo?.estadoTopo) localStorage.setItem('axiona-topo', JSON.stringify(pr.topo.estadoTopo));
    else localStorage.removeItem('axiona-topo'); // predio nuevo: Topo arranca limpio
  } catch { /* */ }
  location.href = '/topo/';
}

/** Proyecto inicial de Obra: el lote de Topo si existe; si no, un rectángulo frente × fondo. */
export function proyectoInicial(pr, { frente = 8, fondo = 15 } = {}) {
  const nombre = `${pr.id} · ${pr.ubicacion.direccion || 'Vivienda'} (${CIUDADES[pr.ciudad].nombre})`;
  if (pr.topo?.obra?.lot?.length >= 3) return { ...pr.topo.obra, nombre };
  return { nombre, lot: [{ x: 0, y: 0, z: 0 }, { x: frente, y: 0, z: 0 }, { x: frente, y: fondo, z: 0 }, { x: 0, y: fondo, z: 0 }], spots: [], frente: 0 };
}

export function abrirObra(pr, opciones) {
  contexto(pr);
  const S = pr.obra?.proyecto || proyectoInicial(pr, opciones);
  location.href = enlaceObra(S);
}
