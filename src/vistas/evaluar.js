// Evaluación de fase 1 (Circular Conjunta 73 de 2026) sobre el expediente del predio, con el Agente Axiona.
import { $, esc, ICON, toast, opciones, confirmar } from '../ui/base.js';
import { S, guardarPredio } from '../nucleo/estado.js';
import * as A from '../nucleo/almacen.js';
import { viviendaDePredio } from '../nucleo/predio.js';
import { CARTELES, NIVELES, NIVEL_TXT, CONDICIONES, SISTEMAS, USOS, ETNIAS, TENENCIAS, FOTOS_GUIADAS, nuevaEvaluacion, faltantes } from '../evaluacion/formulario.js';
import { prepararFoto, ubicar, lienzoFirma } from '../ui/medios.js';
import { consultarAgente, subirEvaluaciones } from '../nucleo/red.js';

const leer = (o, k) => k.split('.').reduce((a, p) => a?.[p], o) ?? '';
const poner = (o, k, v) => { const ps = k.split('.'); let x = o; ps.slice(0, -1).forEach(p => { x = x[p]; }); x[ps.at(-1)] = v; };
const MAPA_FOTOS = { fachada: 'fachada', lateral: 'lateral', danio: 'danio', interior: 'estructura', extra: 'extra' };

export async function render(main, id) {
  if (S.modo !== 'pro') { location.hash = '#/pro'; return; }
  const pr = S.predios.get(id);
  if (!pr) { main.innerHTML = '<div class="card"><h2>Expediente no encontrado</h2></div>'; return; }
  let ev = pr.evaluacionId ? await A.uno('evaluaciones', pr.evaluacionId) : null;
  if (!ev) {
    ev = nuevaEvaluacion(viviendaDePredio(pr), S.ajustes.evaluador);
    // lo que ya trae el expediente no se vuelve a escribir
    ev.edificacion.sistema = pr.vivienda.sistema || ''; ev.edificacion.pisos = pr.vivienda.pisos || 1;
    if (pr.ubicacion.gps) ev.ubicacion = { lat: pr.ubicacion.lat, lon: pr.ubicacion.lon, precision: pr.ubicacion.precision, gps: false };
    Object.assign(ev.hogar, { jefe: pr.contacto.nombre, documento: pr.contacto.documento, telefono: pr.contacto.telefono, personas: pr.hogar.personas, menores: pr.hogar.menores, mayores: pr.hogar.mayores, discapacidad: pr.hogar.discapacidad, tenencia: { propia: 'propia', arriendo: 'arriendo', familiar: 'familiar', poseedor: 'poseedor' }[pr.hogar.tenencia] || '' });
    for (const f of pr.fotos) if (MAPA_FOTOS[f.tipo] && !ev.fotos[MAPA_FOTOS[f.tipo]]) ev.fotos[MAPA_FOTOS[f.tipo]] = f.data;
    const s = pr.senales || {};
    if (s.colapso) ev.condiciones.colapso = 'moderado';
    if (s.inclinacion) ev.condiciones.inclinacion = 'leve';
    if (s.columnas) ev.condiciones.estructural = 'moderado';
    if (s.terreno) ev.condiciones.terreno = 'leve';
    if (s.grietasGrandes) ev.condiciones.muros = 'leve';
    if (s.caida) ev.condiciones.caida = 'leve';
    ev.observaciones = [pr.grietas.filter(g => g.ultima).map(g => `Grieta medida con tarjeta-regla: ${g.ultima.anchoMm} mm (${g.elemento}, ${g.patron}).`).join(' '), pr.inclinaciones.map(i => `Desplome medido: ${i.deriva.toFixed(2)} % en ${i.elemento}.`).join(' ')].filter(Boolean).join(' ');
    await A.guardar('evaluaciones', ev);
    pr.evaluacionId = ev.id; await guardarPredio(pr, 'Evaluación de fase 1 iniciada');
  }
  const firmada = ev.estado === 'firmada';
  const campo = (k, lbl, tipo = 'text', extra = '') => `<label class="campo"><span>${lbl}</span><input type="${tipo}" data-k="${k}" value="${esc(leer(ev, k))}" ${extra} ${firmada ? 'disabled' : ''}></label>`;
  const sel = (k, lbl, lista) => `<label class="campo"><span>${lbl}</span><select data-k="${k}" ${firmada ? 'disabled' : ''}>${opciones(lista, leer(ev, k))}</select></label>`;

  main.innerHTML = `<div class="cabecera"><div><span class="tenue mono">${esc(pr.id)} · ${esc(ev.id)}</span><h1 style="margin-top:4px">Evaluación fase 1</h1><p class="sub">${esc(pr.ubicacion.direccion)} · Circular Conjunta 73 de 2026 · <a href="#/expediente/${pr.id}">expediente</a></p></div>${firmada ? `<span class="tag" style="color:${CARTELES[ev.decision.cartel].color}">Firmada · ${esc(CARTELES[ev.decision.cartel].nombre)}</span>` : ''}</div>
  ${!S.ajustes.evaluador.matricula ? `<div class="aviso ambar" style="margin:10px 0">${ICON.info}<span>Registre sus datos de evaluador (matrícula y RUPE) en <a href="#/pro/ajustes">Ajustes</a> para poder firmar.</span></div>` : ''}
  <div class="col2" style="margin-top:12px"><div class="pila">
    <div class="card"><h3>1 · Ubicación en sitio</h3><div class="fila" style="margin-top:6px"><button class="btn" id="gps" ${firmada ? 'disabled' : ''}>${ICON.ubicacion} Tomar GPS en sitio</button><span class="tenue mono" id="gpsTxt"></span></div></div>
    <div class="card"><h3>2 · Edificación</h3><div class="formulario" style="margin-top:6px">${sel('edificacion.uso', 'Uso', USOS)}${sel('edificacion.sistema', 'Sistema estructural', SISTEMAS)}${campo('edificacion.pisos', 'Pisos', 'number', 'min="1"')}${campo('edificacion.hogares', 'Hogares', 'number', 'min="0"')}</div></div>
    <div class="card"><h3>3 · Condiciones observadas</h3><p class="tenue">Prellenadas con lo que reportó el ciudadano: verifique cada una.</p>${CONDICIONES.map(c => `<div style="margin-top:12px"><b>${esc(c.t)}</b>${c.critica ? ' <span class="tag rojo">crítica</span>' : ''}<br><small class="sub">${esc(c.ayuda)}</small><div class="opcs" style="margin-top:6px" data-cond="${c.id}">${NIVELES.map(n => `<label><input type="radio" name="c-${c.id}" value="${n}" ${ev.condiciones[c.id] === n ? 'checked' : ''} ${firmada ? 'disabled' : ''}>${NIVEL_TXT[n]}</label>`).join('')}</div></div>`).join('')}
      <label class="campo" style="margin-top:12px"><span>Observaciones</span><textarea data-k="observaciones" ${firmada ? 'disabled' : ''}>${esc(ev.observaciones)}</textarea></label></div>
    <div class="card"><h3>4 · Fotografías</h3><div class="fotos" style="margin-top:8px">${FOTOS_GUIADAS.map(f => `<label class="foto ${ev.fotos[f.id] ? 'lista' : ''}">${ev.fotos[f.id] ? `<img src="${ev.fotos[f.id]}" alt=""><span class="ok">✓</span>` : `${ICON.camara}<b>${esc(f.t)}</b><small>${esc(f.ayuda)}</small>`}<input type="file" accept="image/*" capture="environment" data-foto="${f.id}" hidden ${firmada ? 'disabled' : ''}></label>`).join('')}</div></div>
    <div class="card"><h3>5 · Hogar (RUD)</h3><div class="formulario" style="margin-top:6px">${campo('hogar.jefe', 'Jefe de hogar')}${campo('hogar.documento', 'Documento')}${campo('hogar.telefono', 'Teléfono', 'tel')}${campo('hogar.personas', 'Personas', 'number')}${campo('hogar.menores', 'Menores', 'number')}${campo('hogar.mayores', 'Mayores', 'number')}${campo('hogar.discapacidad', 'Discapacidad', 'number')}${sel('hogar.etnia', 'Autorreconocimiento étnico', ETNIAS)}${sel('hogar.tenencia', 'Tenencia', TENENCIAS)}${sel('hogar.zona', 'Zona', [['urbana', 'Urbana'], ['rural', 'Rural dispersa']])}</div>
      <label class="chequeo" style="margin-top:8px"><input type="checkbox" data-k="hogar.consentimiento" ${ev.hogar.consentimiento || pr.contacto.consentimiento ? 'checked' : ''} ${firmada ? 'disabled' : ''}><span><b>El jefe de hogar autoriza el tratamiento de datos (Ley 1581)</b></span></label></div>
  </div><div class="pila">
    <div class="card borde"><h3>${ICON.chispa} Agente Axiona</h3><p class="sub">Revisa fotos y formulario, avisa faltantes e inconsistencias y sugiere el cartel. <b>El cartel lo decide y firma usted.</b></p><button class="btn pri" id="agente" ${firmada ? 'disabled' : ''}>Revisar con el Agente Axiona</button><div id="agenteOut"></div></div>
    <div class="card"><h3>6 · Decisión del evaluador</h3><div class="opcs" id="carteles" style="margin-top:8px">${Object.entries(CARTELES).map(([k, c]) => `<label style="border-color:${c.color}55"><input type="radio" name="cartel" value="${k}" ${ev.decision.cartel === k ? 'checked' : ''} ${firmada ? 'disabled' : ''}><b style="color:${c.color}">${esc(c.corto)}</b></label>`).join('')}</div>
      <p class="sub" id="cartelTxt" style="margin-top:6px">${ev.decision.cartel ? esc(CARTELES[ev.decision.cartel].texto) : 'Seleccione el cartel según su criterio profesional.'}</p>
      <label class="campo"><span>Restricciones de uso</span><textarea data-k="decision.restricciones" ${firmada ? 'disabled' : ''}>${esc(ev.decision.restricciones)}</textarea></label>
      <label class="campo" style="margin-top:8px"><span>Justificación</span><textarea data-k="decision.justificacion" ${firmada ? 'disabled' : ''}>${esc(ev.decision.justificacion)}</textarea></label>
      <div class="chequeos" style="margin-top:8px"><label class="chequeo"><input type="checkbox" data-k="decision.apuntalar" ${ev.decision.apuntalar ? 'checked' : ''} ${firmada ? 'disabled' : ''}><span><b>Requiere apuntalamiento</b></span></label><label class="chequeo"><input type="checkbox" data-k="decision.evacuar" ${ev.decision.evacuar ? 'checked' : ''} ${firmada ? 'disabled' : ''}><span><b>Se recomienda evacuación</b></span></label></div></div>
    <div class="card"><h3>7 · Firma</h3>${firmada ? `<img src="${ev.firma}" alt="Firma" style="height:70px;background:#fff;border-radius:8px"><p class="tenue">${esc(ev.evaluador.nombre)} · Mat. ${esc(ev.evaluador.matricula)} · ${esc(ev.evaluador.rupe)} · ${new Date(ev.firmada).toLocaleString('es-CO')}</p>`
      : `<p class="sub">Firma como <b>${esc(S.ajustes.evaluador.nombre || '—')}</b> · Mat. ${esc(S.ajustes.evaluador.matricula || '—')} · ${esc(S.ajustes.evaluador.rupe || '—')}</p><canvas class="firma" id="firma"></canvas><div class="fila" style="margin-top:6px"><button class="btn sm" id="limpiar">Borrar firma</button></div><div id="faltan" style="margin-top:8px"></div><button class="btn pri bloque" id="firmar" style="margin-top:10px">Firmar concepto</button>`}</div>
  </div></div>`;

  const pintarFalta = () => {
    $('#gpsTxt', main).textContent = ev.ubicacion.gps ? `${ev.ubicacion.lat}, ${ev.ubicacion.lon} · ±${ev.ubicacion.precision ?? '?'} m` : 'Sin GPS tomado en sitio';
    const F = $('#faltan', main); if (!F) return;
    const f = faltantes(ev);
    F.innerHTML = f.length ? `<div class="aviso ambar">${ICON.info}<span>Para firmar falta: ${esc(f.join(' · '))}</span></div>` : `<div class="aviso">${ICON.ok}<span>Lista para firmar.</span></div>`;
  };
  let t;
  const guardar = () => { clearTimeout(t); t = setTimeout(() => { ev.actualizada = new Date().toISOString(); A.guardar('evaluaciones', ev); }, 300); pintarFalta(); };
  const pintarAgente = () => {
    const a = ev.agente; if (!a) return;
    const c = CARTELES[a.cartel];
    $('#agenteOut', main).innerHTML = `${a.aviso ? `<div class="aviso ambar" style="margin-top:8px">${esc(a.aviso)}</div>` : ''}<p style="margin-top:10px"><span class="tag" style="color:${c?.color}">Sugerencia: ${esc(c?.corto)}</span> <span class="tenue">${a.origen === 'claude' ? `Claude · confianza ${esc(a.confianza)}` : 'Reglas sin conexión'}</span></p><p>${esc(a.justificacion)}</p>
      ${a.hallazgos?.length ? `<ul class="sub">${a.hallazgos.map(h => `<li><b>${esc(h.foto)}:</b> ${esc(h.observacion)}</li>`).join('')}</ul>` : ''}${a.faltantes?.length ? `<div class="aviso ambar">Falta: ${esc(a.faltantes.join(' · '))}</div>` : ''}${a.inconsistencias?.length ? `<div class="aviso rojo" style="margin-top:6px">Inconsistencias: ${esc(a.inconsistencias.join(' · '))}</div>` : ''}
      ${a.restricciones ? `<p class="sub" style="margin-top:6px"><b>Restricciones sugeridas:</b> ${esc(a.restricciones)} <button class="btn sm" id="usarR">Usar</button></p>` : ''}${a.borrador ? `<details class="saber"><summary>Borrador de concepto</summary><p style="white-space:pre-wrap">${esc(a.borrador)}</p></details>` : ''}`;
    $('#usarR', main)?.addEventListener('click', () => { ev.decision.restricciones = a.restricciones; main.querySelector('[data-k="decision.restricciones"]').value = a.restricciones; guardar(); });
  };
  main.addEventListener('input', e => { const k = e.target.dataset.k; if (k && e.target.type !== 'checkbox') { poner(ev, k, e.target.type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value); guardar(); } });
  main.addEventListener('change', async e => {
    const x = e.target;
    if (x.dataset.k && x.type === 'checkbox') { poner(ev, x.dataset.k, x.checked); guardar(); }
    if (x.dataset.k && x.tagName === 'SELECT') { poner(ev, x.dataset.k, x.value); guardar(); }
    const cond = x.closest('[data-cond]'); if (cond) { ev.condiciones[cond.dataset.cond] = x.value; guardar(); }
    if (x.name === 'cartel') { ev.decision.cartel = x.value; ev.decision.fase2 = x.value !== 'verde'; $('#cartelTxt', main).textContent = CARTELES[x.value].texto; if (ev.agente && ev.agente.cartel !== x.value) toast('Su decisión difiere de la sugerencia del agente: queda registrada.'); guardar(); }
    if (x.dataset.foto && x.files?.[0]) { ev.fotos[x.dataset.foto] = await prepararFoto(x.files[0], `${pr.id} · ${new Date().toLocaleString('es-CO')} · ${ev.ubicacion.lat ?? ''}, ${ev.ubicacion.lon ?? ''}`); guardar(); const l = x.closest('label.foto'); l.classList.add('lista'); l.querySelectorAll('svg,b,small,img,.ok').forEach(n => n.remove()); l.insertAdjacentHTML('afterbegin', `<img src="${ev.fotos[x.dataset.foto]}" alt=""><span class="ok">✓</span>`); }
  });
  $('#gps', main)?.addEventListener('click', async () => { try { const u = await ubicar(); ev.ubicacion = { ...ev.ubicacion, ...u }; guardar(); toast(`GPS ±${u.precision} m`); } catch (er) { toast(er.message, 4000, 'error'); } });
  $('#agente', main)?.addEventListener('click', async () => { const b = $('#agente', main); b.disabled = true; b.innerHTML = '<span class="cargando"></span> Revisando…'; ev.agente = await consultarAgente(ev); await A.guardar('evaluaciones', ev); b.disabled = false; b.textContent = 'Revisar de nuevo'; pintarAgente(); });
  let firma = null;
  if (!firmada) { firma = lienzoFirma($('#firma', main)); $('#limpiar', main).onclick = () => firma.limpiar(); }
  $('#firmar', main)?.addEventListener('click', async () => {
    ev.evaluador = { ...S.ajustes.evaluador };
    const f = faltantes(ev);
    if (f.length) return toast('Antes de firmar: ' + f[0], 3500, 'error');
    if (firma.vacia()) return toast('Falta su firma.', 3000, 'error');
    if (!(await confirmar('Firmar el concepto', `Cartel ${CARTELES[ev.decision.cartel].corto}. Un concepto firmado no se edita; los cambios se hacen con una nueva versión.`, { si: 'Firmar' }))) return;
    Object.assign(ev, { firma: firma.imagen(), estado: 'firmada', firmada: new Date().toISOString(), version: (ev.version || 1) + 1, sincronizada: false });
    ev.decision.coincideAgente = ev.agente ? ev.agente.cartel === ev.decision.cartel : null;
    await A.guardar('evaluaciones', ev);
    pr.evaluacionResumen = { cartel: ev.decision.cartel, restricciones: ev.decision.restricciones, fase2: ev.decision.fase2, condiciones: ev.condiciones, fecha: ev.firmada, evaluador: `${ev.evaluador.nombre} · Mat. ${ev.evaluador.matricula}`, coincideAgente: ev.decision.coincideAgente };
    if (['reportado', 'en_cola', 'asignado', 'borrador'].includes(pr.estado)) pr.estado = 'evaluado';
    await guardarPredio(pr, `Concepto fase 1 firmado: ${CARTELES[ev.decision.cartel].corto}`);
    if (navigator.onLine) subirEvaluaciones([ev]).then(r => { if (r?.subidas) { ev.sincronizada = true; A.guardar('evaluaciones', ev); } }).catch(() => {});
    toast('Concepto firmado.'); location.hash = `#/expediente/${pr.id}`;
  });
  pintarAgente(); pintarFalta();
}
