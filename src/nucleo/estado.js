/* ==========================================================================
   AXIONA EVALÚA · Estado de la aplicación
   --------------------------------------------------------------------------
   Ciudad, modo (ciudadano o profesional), ajustes editables y predios. Cada
   vez que se guarda un predio se recalculan solos: sismo en el sitio,
   orientación al ciudadano y lectura de grietas e inclinaciones.
   ========================================================================== */
import * as A from './almacen.js';
import { CIUDADES } from './ciudades.js';
import { prediosDemo, anotar } from './predio.js';
import { sismoEnSitio } from '../sismo/sitio.js';
import { orientar, leerGrieta, REGLAS_GRIETA, categoriaBRE } from '../medir/orientacion.js';
import { PESOS_BASE, FRAGILIDAD } from './prioridad.js';
import { FECHAS } from '../derechos/motor.js';

export const S = {
  ciudad: 'quibdo', modo: 'ciudadano', pin: '',
  ajustes: { pesos: { ...PESOS_BASE }, fragilidad: { ...FRAGILIDAD }, reglas: structuredClone(REGLAS_GRIETA), fechas: { ...FECHAS }, nsr: {}, tarjetaFactor: 1, ipc: '', evaluador: { nombre: '', profesion: 'Ingeniero civil', matricula: '', rupe: '', perfil: 'P1' } },
  predios: new Map(), mallas: {}, remotos: new Map(),
};

export async function iniciarEstado() {
  const g = await A.ajuste('general');
  if (g) Object.assign(S, { ciudad: g.ciudad || S.ciudad, modo: g.modo || S.modo });
  const aj = await A.ajuste('ajustes');
  if (aj) S.ajustes = { ...S.ajustes, ...aj, pesos: { ...S.ajustes.pesos, ...aj.pesos }, fechas: { ...S.ajustes.fechas, ...aj.fechas } };
  const lista = await A.todos('predios');
  lista.forEach(p => S.predios.set(p.id, p));
  // la demostración se siembra una vez por ciudad (marcada como demo)
  for (const c of Object.keys(CIUDADES)) {
    if (!(await A.ajuste(`demo-${c}`))) {
      const demo = prediosDemo(c);
      await cargarMalla(c);
      for (const p of demo) { derivar(p); S.predios.set(p.id, p); }
      await A.guardarVarios('predios', demo);
      await A.ajuste(`demo-${c}`, true);
    }
  }
}

export const guardarGeneral = () => A.ajuste('general', { ciudad: S.ciudad, modo: S.modo });
export const guardarAjustes = () => A.ajuste('ajustes', S.ajustes);
export const nsrCiudad = c => ({ ...CIUDADES[c].nsr10, ...(S.ajustes.nsr?.[c] || {}) });

export async function cargarMalla(ciudad) {
  if (S.mallas[ciudad]) return S.mallas[ciudad];
  try { S.mallas[ciudad] = await (await fetch('/' + CIUDADES[ciudad].sismo)).json(); } catch { S.mallas[ciudad] = null; }
  return S.mallas[ciudad];
}

/** Recalcula lo que se deriva de los datos del predio. */
export function derivar(pr) {
  const m = S.mallas[pr.ciudad];
  if (m && pr.ubicacion.lat !== null) {
    const s = sismoEnSitio(m, pr.ubicacion);
    pr.sismo = s ? { mmi: r2(s.mmi), pga: r2(s.pga), pgv: r2(s.pgv), psa: Object.fromEntries(Object.entries(s.psa).map(([k, v]) => [k, r2(v)])), vs30: Math.round(s.vs30 || 0), licuacion: s.licuacion === null ? null : r3(s.licuacion), deslizamiento: s.deslizamiento === null ? null : r3(s.deslizamiento) } : null;
  }
  for (const g of pr.grietas || []) {
    if (!g.ultima) continue;
    g.ultima.categoria = categoriaBRE(g.ultima.anchoMm).cat;
    g.lectura = leerGrieta({ elemento: g.elemento, patron: g.patron, anchoMm: g.ultima.anchoMm, previaMm: g.previa?.anchoMm }, S.ajustes.reglas);
  }
  pr.orientacion = orientar(pr, S.ajustes.reglas);
  return pr;
}
const r2 = v => (v === null || v === undefined ? null : Math.round(v * 100) / 100);
const r3 = v => Math.round(v * 1000) / 1000;

export async function guardarPredio(pr, evento) {
  await cargarMalla(pr.ciudad);
  derivar(pr);
  if (evento) anotar(pr, evento, S.modo);
  else { pr.actualizado = new Date().toISOString(); pr.version = (pr.version || 0) + 1; pr.sincronizado = false; }
  S.predios.set(pr.id, pr);
  await A.guardar('predios', pr);
  return pr;
}

export async function borrarPredio(id) { S.predios.delete(id); await A.borrar('predios', id); }

/** Integra lo que Topo y Obra dejaron en el puente (mismo sitio) al volver al expediente. */
export async function integrarPuente(pr) {
  let d = null;
  try { d = JSON.parse(localStorage.getItem('axiona-puente:' + pr.id) || 'null'); } catch { d = null; }
  if (!d) return false;
  let cambio = false;
  if (d.topo && JSON.stringify(d.topo) !== JSON.stringify(pr.topo)) { pr.topo = d.topo; cambio = 'Levantamiento recibido de Axiona Topo'; }
  if (d.obra && JSON.stringify(d.obra.resumen) !== JSON.stringify(pr.obra?.resumen)) { pr.obra = d.obra; cambio = 'Diseño y presupuesto recibidos de Axiona Obra'; if (['evaluado', 'asignado', 'en_cola', 'reportado'].includes(pr.estado)) pr.estado = 'en_diseno'; }
  if (cambio) await guardarPredio(pr, cambio);
  return !!cambio;
}

export const prediosCiudad = (c = S.ciudad) => [...S.predios.values()].filter(p => p.ciudad === c);
export const misPredios = () => [...S.predios.values()].filter(p => !p.demo && p.origen === 'ciudadano').sort((a, b) => b.actualizado.localeCompare(a.actualizado));
