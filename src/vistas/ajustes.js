// Ajustes editables por la coordinación: pesos de prioridad, umbrales de grietas, fechas legales, NSR-10 y evaluador.
import { $, esc, ICON, toast, num } from '../ui/base.js';
import { S, guardarAjustes, derivar } from '../nucleo/estado.js';
import * as A from '../nucleo/almacen.js';
import { PESOS_BASE, NOMBRES_COMPONENTES, FRAGILIDAD } from '../nucleo/prioridad.js';
import { REGLAS_GRIETA, ELEMENTOS } from '../medir/orientacion.js';
import { FECHAS, vigencias } from '../derechos/motor.js';
import { CIUDADES } from '../nucleo/ciudades.js';
import { textoFecha } from '../nucleo/calendario.js';

const NF = { fechas: { sismo: 'Sismo', desastreDesde: 'Inicio de la situación de desastre (D. 1171)', publicacion1423: 'Publicación del Decreto 1423 en el Diario Oficial', expedicion1422: 'Expedición del Decreto 1422', cierreRUD: 'Cierre del RUD' } };

export async function render(main) {
  if (S.modo !== 'pro') { location.hash = '#/pro'; return; }
  const aj = S.ajustes;
  const V = vigencias(aj.fechas);
  main.innerHTML = `<h1>Ajustes</h1><p class="sub">Todo lo que requiere criterio humano se cambia aquí, sin tocar el código. Se guarda en este equipo.</p>
  <div class="rejilla dos" style="margin-top:14px">
    <div class="card"><h3>Pesos de la prioridad</h3><p class="sub">Se normalizan para sumar 1.</p><div class="formulario" style="margin-top:8px">${Object.keys(PESOS_BASE).map(k => `<label class="campo"><span>${esc(NOMBRES_COMPONENTES[k])}</span><input type="number" step="0.01" min="0" data-peso="${k}" value="${aj.pesos[k]}"></label>`).join('')}</div>
      <h3 style="margin-top:14px">Fragilidad por sistema (0–1)</h3><div class="formulario">${Object.keys(FRAGILIDAD).filter(Boolean).map(k => `<label class="campo"><span>${esc(k)}</span><input type="number" step="0.05" min="0" max="1" data-frag="${k}" value="${aj.fragilidad[k] ?? FRAGILIDAD[k]}"></label>`).join('')}</div></div>
    <div class="card"><h3>Umbrales de grietas (mm) [revisión, alerta]</h3><p class="sub">Reglas v1 de orientación al ciudadano; las debe validar el ingeniero coordinador.</p>
      <table class="tabla">${Object.entries(aj.reglas).filter(([, v]) => typeof v === 'object').map(([el, pats]) => Object.entries(pats).map(([pat, [r, a]]) => `<tr><td>${esc(ELEMENTOS[el] || el)}</td><td>${esc(pat)}</td><td><input type="number" step="0.05" data-regla="${el}.${pat}.0" value="${r}" style="width:80px"></td><td><input type="number" step="0.05" data-regla="${el}.${pat}.1" value="${a}" style="width:80px"></td></tr>`).join('')).join('')}</table>
      <div class="formulario" style="margin-top:8px"><label class="campo"><span>Crecimiento que alerta (mm)</span><input type="number" step="0.05" data-crec="crecimientoMm" value="${aj.reglas.crecimientoMm}"></label><label class="campo"><span>Crecimiento relativo</span><input type="number" step="0.05" data-crec="crecimientoRel" value="${aj.reglas.crecimientoRel}"></label></div></div>
    <div class="card"><h3>Fechas legales</h3><p class="sub">Las que dependen del Diario Oficial están por confirmar. Cambiarlas recalcula todos los plazos.</p><div class="pila" style="margin-top:8px">${Object.keys(FECHAS).map(k => `<label class="campo"><span>${esc(NF.fechas[k])}</span><input type="date" data-fecha="${k}" value="${aj.fechas[k]}"></label>`).join('')}</div>
      <div class="formula" style="margin-top:10px">Arriendo (D. 1423, Título I): hasta ${textoFecha(V.arriendoHasta, false)}
Propiedad horizontal (Título II): hasta ${textoFecha(V.phHasta, false)}
Situación de desastre: hasta ${textoFecha(V.desastreHasta, false)}
Reúso con subsidio (D. 1422): hasta ${textoFecha(V.reusoHasta, false)}</div></div>
    <div class="card"><h3>Parámetros NSR-10</h3><div class="pila" style="margin-top:8px">${Object.values(CIUDADES).map(c => { const n = { ...c.nsr10, ...(aj.nsr?.[c.id] || {}) }; return `<div><b>${esc(c.nombre)}</b> ${n.verificado ? '<span class="tag verde">verificado</span>' : '<span class="tag ambar">por verificar</span>'}<div class="formulario"><label class="campo"><span>Aa</span><input type="number" step="0.01" data-nsr="${c.id}.Aa" value="${n.Aa}"></label><label class="campo"><span>Av</span><input type="number" step="0.01" data-nsr="${c.id}.Av" value="${n.Av}"></label></div><p class="tenue">${esc(n.fuente)}</p></div>`; }).join('')}</div></div>
    <div class="card"><h3>Evaluador de este equipo</h3><div class="formulario" style="margin-top:8px">${[['nombre', 'Nombre'], ['profesion', 'Profesión'], ['matricula', 'Matrícula profesional'], ['rupe', 'Inscripción RUPE']].map(([k, t]) => `<label class="campo"><span>${t}</span><input data-ev="${k}" value="${esc(aj.evaluador[k] || '')}"></label>`).join('')}</div></div>
    <div class="card"><h3>Datos de demostración</h3><p class="sub">Se marcan como «demo» y no se envían al servidor.</p><button class="btn peligro" id="quitarDemo">Quitar la demostración de este equipo</button></div>
  </div>
  <div class="fila fin" style="margin-top:14px"><button class="btn" id="restaurar">Restaurar valores base</button><button class="btn pri" id="guardar">${ICON.ok} Guardar ajustes</button></div>`;
  $('#guardar', main).onclick = async () => {
    main.querySelectorAll('[data-peso]').forEach(i => { aj.pesos[i.dataset.peso] = Math.max(0, +i.value || 0); });
    main.querySelectorAll('[data-frag]').forEach(i => { aj.fragilidad[i.dataset.frag] = Math.min(1, Math.max(0, +i.value || 0)); });
    main.querySelectorAll('[data-regla]').forEach(i => { const [el, pat, k] = i.dataset.regla.split('.'); aj.reglas[el][pat][+k] = +i.value; });
    main.querySelectorAll('[data-crec]').forEach(i => { aj.reglas[i.dataset.crec] = +i.value; });
    main.querySelectorAll('[data-fecha]').forEach(i => { if (i.value) aj.fechas[i.dataset.fecha] = i.value; });
    main.querySelectorAll('[data-nsr]').forEach(i => { const [c, k] = i.dataset.nsr.split('.'); aj.nsr = aj.nsr || {}; aj.nsr[c] = { ...(aj.nsr[c] || {}), [k]: +i.value }; });
    main.querySelectorAll('[data-ev]').forEach(i => { aj.evaluador[i.dataset.ev] = i.value.trim(); });
    await guardarAjustes();
    for (const p of S.predios.values()) { derivar(p); await A.guardar('predios', p); }
    toast('Ajustes guardados y aplicados.'); render(main);
  };
  $('#restaurar', main).onclick = async () => { aj.pesos = { ...PESOS_BASE }; aj.fragilidad = { ...FRAGILIDAD }; aj.reglas = structuredClone(REGLAS_GRIETA); aj.fechas = { ...FECHAS }; aj.nsr = {}; await guardarAjustes(); toast('Valores base restaurados.'); render(main); };
  $('#quitarDemo', main).onclick = async () => { for (const p of [...S.predios.values()].filter(x => x.demo)) { S.predios.delete(p.id); await A.borrar('predios', p.id); } toast('Demostración quitada.'); };
  return () => {};
}
export { num };
