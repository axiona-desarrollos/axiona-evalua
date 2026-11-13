/* ==========================================================================
   AXIONA EVALÚA · Aplicación
   --------------------------------------------------------------------------
   Plataforma de evaluación de edificaciones post-sismo para la Alcaldía de
   Quibdó. Funciona sin internet (IndexedDB + service worker), aplica la fase 1
   de la Circular Conjunta 73 de 2026 y consulta al Agente Axiona (Claude, de
   Anthropic) cuando hay señal. El cartel lo asigna y firma el evaluador.
   Axiona Desarrollos Inteligentes.
   ========================================================================== */
import './estilos.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as A from './almacen.js';
import { CARTELES, NIVELES, NIVEL_TXT, CONDICIONES, SISTEMAS, USOS, ETNIAS, TENENCIAS, FOTOS_GUIADAS, nuevaEvaluacion, faltantes, puedeFirmar } from './formulario.js';
import { viviendasDemo, evaluacionesDemo, CENTRO, BARRIOS } from './datos.js';
import { prepararFoto, ubicar, lienzoFirma } from './medios.js';
import { consultarAgente, subir, bajar, ponerPin, verificarPin } from './red.js';
import { csvEDAN, csvRUD, descargar } from './exportar.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const opciones = (lista, v, vacia = 'Selecciona…') => `<option value="">${vacia}</option>` + lista.map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('');
const fecha = iso => iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '';
const ROLES = {
  evaluador: { n: 'Evaluador habilitado', d: 'Inspecciona, asigna el cartel y firma', firma: true, tablero: false },
  apoyo: { n: 'Apoyo de campo', d: 'Fotos, ubicación y datos; no firma', firma: false, tablero: false },
  coordinacion: { n: 'Coordinación', d: 'Asigna, revisa y aprueba', firma: false, tablero: true },
  despacho: { n: 'Despacho del Alcalde', d: 'Tablero de mando e informes', firma: false, tablero: true },
};

const S = { sesion: null, viviendas: [], evs: new Map(), remotas: new Map(), mapa: null, ctl: new AbortController() };
/** Escucha eventos de la vista actual; se sueltan al cambiar de vista. */
const en = (tipo, fn) => $('#app').addEventListener(tipo, fn, { signal: S.ctl.signal });

function toast(t, ms = 2600) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.append(d);
  setTimeout(() => d.remove(), ms);
}

async function hashPin(p) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('axiona-evalua|' + p));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ---------------- datos ---------------- */
async function cargar() {
  S.viviendas = await A.todos('viviendas');
  if (!S.viviendas.length) {
    S.viviendas = viviendasDemo();
    await A.guardarVarios('viviendas', S.viviendas);
    await A.guardarVarios('evaluaciones', evaluacionesDemo(S.viviendas));
  }
  (await A.todos('evaluaciones')).forEach(e => S.evs.set(e.id, e));
}
const evDe = vid => [...S.evs.values()].filter(e => e.viviendaId === vid).sort((a, b) => (b.actualizada || '').localeCompare(a.actualizada || ''))[0];
const remDe = vid => [...S.remotas.values()].filter(e => e.viviendaId === vid).sort((a, b) => (b.actualizada || '').localeCompare(a.actualizada || ''))[0];
const ultimaDe = vid => { const a = evDe(vid), b = remDe(vid); if (!a) return b; if (!b) return a; return (b.version || 0) > (a.version || 0) ? b : a; };
async function guardarEv(ev) { ev.actualizada = new Date().toISOString(); S.evs.set(ev.id, ev); await A.guardar('evaluaciones', ev); }

/* ---------------- sincronización ---------------- */
let sincronizando = false;
async function sincronizar(avisar = false) {
  if (sincronizando || !navigator.onLine || !S.sesion) return;
  sincronizando = true;
  try {
    const pend = [...S.evs.values()].filter(e => !e.sincronizada && !e.demo && ['firmada', 'lista'].includes(e.estado));
    let n = 0;
    for (let i = 0; i < pend.length; i += 4) {
      const lote = pend.slice(i, i + 4);
      const r = await subir(lote);
      for (const id of r.ids || []) { const e = S.evs.get(id); if (e) { e.sincronizada = true; await A.guardar('evaluaciones', e); n++; } }
    }
    const d = await bajar();
    if (d?.evaluaciones) { S.remotas.clear(); d.evaluaciones.forEach(e => S.remotas.set(e.id, e)); S.ultimaSync = new Date(); }
    if (avisar) toast(n ? `Sincronizadas ${n} evaluaciones.` : 'Todo está al día.');
    pintarEstadoRed();
  } catch (e) { if (avisar) toast('No se pudo sincronizar: ' + e.message); }
  finally { sincronizando = false; }
}
const pendientesSync = () => [...S.evs.values()].filter(e => !e.sincronizada && !e.demo && ['firmada', 'lista'].includes(e.estado)).length;
function pintarEstadoRed() {
  const p = $('#estadoRed'); if (!p) return;
  const n = pendientesSync();
  p.className = 'pill' + (navigator.onLine ? '' : ' off');
  p.innerHTML = `<i></i>${navigator.onLine ? 'En línea' : 'Sin señal'}${n ? ` · ${n} por subir` : ''}`;
}
addEventListener('online', () => { pintarEstadoRed(); sincronizar(); });
addEventListener('offline', pintarEstadoRed);
setInterval(() => sincronizar(), 60000);

/* ---------------- marco ---------------- */
function marco(activa, cuerpo) {
  const r = ROLES[S.sesion.rol];
  const tabs = [['campo', 'Campo'], ...(r.tablero || S.sesion.rol === 'evaluador' ? [['tablero', 'Tablero']] : []), ['ayuda', 'Cómo funciona']];
  $('#app').innerHTML = `<header class="top"><div class="in">
      <div class="marca"><img src="./icono-192.png" alt=""><div><b>AXIONA EVALÚA</b><small>Alcaldía de Quibdó · ${esc(r.n)} · ${esc(S.sesion.nombre)}</small></div></div>
      <span id="estadoRed" class="pill"></span>
    </div><nav class="nav">${tabs.map(([k, n]) => `<a href="#/${k}" class="${k === activa ? 'on' : ''}">${n}</a>`).join('')}<a href="#/salir">Salir</a></nav></header>
    <main class="wrap">${cuerpo}</main>`;
  pintarEstadoRed();
}

/* ---------------- ingreso ---------------- */
function vistaIngreso() {
  let rol = 'evaluador';
  $('#app').innerHTML = `<div class="ingreso"><div class="card">
    <div class="marca" style="margin-bottom:14px"><img src="./icono-192.png" alt=""><div><b>AXIONA EVALÚA</b><small>Evaluación de edificaciones post-sismo · Quibdó</small></div></div>
    <h2>Ingreso</h2>
    <p class="sub">Plataforma de la Alcaldía de Quibdó para la fase 1 de la Circular Conjunta 73 de 2026 (UNGRD–IDIGER).</p>
    <form id="fIngreso" class="lista">
      <label class="campo">Código de acceso<input type="password" name="pin" required autocomplete="current-password" inputmode="text"></label>
      <div class="campo" style="color:var(--mut);font-weight:600;font-size:13px">Rol</div>
      <div class="roles">${Object.entries(ROLES).map(([k, r]) => `<button type="button" data-rol="${k}" class="${k === rol ? 'on' : ''}"><b>${r.n}</b><small>${r.d}</small></button>`).join('')}</div>
      <label class="campo">Nombre completo<input type="text" name="nombre" required autocomplete="name"></label>
      <div id="datosEval" class="grid2">
        <label class="campo">Profesión<select name="profesion">${opciones([['Ingeniero civil', 'Ingeniero civil'], ['Arquitecto', 'Arquitecto'], ['Estudiante con aval', 'Estudiante con aval universitario']], 'Ingeniero civil')}</select></label>
        <label class="campo">Perfil (Circular 73)<select name="perfil">${opciones([['P1', 'P1 · Ingeniero o arquitecto con matrícula'], ['P2', 'P2 · Verificador con experiencia'], ['P3', 'P3 · Especialista estructural'], ['P4', 'P4 · Geotecnia'], ['P5', 'P5 · Patólogo estructural']], 'P1')}</select></label>
        <label class="campo">Matrícula profesional<input type="text" name="matricula" autocomplete="off"></label>
        <label class="campo">Inscripción RUPE<input type="text" name="rupe" autocomplete="off"></label>
      </div>
      <button class="btn pri">Entrar</button>
      <p class="leyenda">Versión de demostración con datos ficticios. La información real es de la Alcaldía de Quibdó y se trata conforme a la Ley 1581 de 2012.</p>
    </form></div></div>`;
  const f = $('#fIngreso');
  const ajustar = () => { $('#datosEval').style.display = rol === 'evaluador' ? '' : 'none'; f.matricula.required = f.rupe.required = rol === 'evaluador'; };
  f.addEventListener('click', e => { const b = e.target.closest('[data-rol]'); if (!b) return; rol = b.dataset.rol; f.querySelectorAll('[data-rol]').forEach(x => x.classList.toggle('on', x === b)); ajustar(); });
  ajustar();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f).entries());
    const btn = f.querySelector('.btn.pri'); btn.disabled = true; btn.textContent = 'Verificando…';
    const h = await hashPin(d.pin);
    const guardado = await A.ajuste('pinHash');
    let ok = navigator.onLine ? await verificarPin(d.pin) : guardado === h;
    if (!navigator.onLine && !guardado) ok = false;
    btn.disabled = false; btn.textContent = 'Entrar';
    if (!ok) return toast(navigator.onLine ? 'Código de acceso incorrecto.' : 'Sin señal: entra una vez con internet para habilitar este equipo.');
    await A.ajuste('pinHash', h);
    S.sesion = { rol, nombre: d.nombre.trim(), profesion: d.profesion, perfil: d.perfil, matricula: (d.matricula || '').trim(), rupe: (d.rupe || '').trim(), pin: d.pin };
    ponerPin(d.pin);
    await A.ajuste('sesion', S.sesion);
    location.hash = ROLES[rol].tablero ? '#/tablero' : '#/campo';
    ruta();
    sincronizar();
  });
}

/* ---------------- campo ---------------- */
function estadoVivienda(v) {
  const e = ultimaDe(v.id);
  if (!e) return { t: 'Pendiente', c: '#55606d', e: null };
  if (e.estado === 'firmada') return { t: CARTELES[e.decision.cartel]?.corto || 'Firmada', c: CARTELES[e.decision.cartel]?.color || '#55606d', e };
  if (e.estado === 'lista') return { t: 'Lista para firma', c: '#3ccbf4', e };
  return { t: 'En curso', c: '#a78bfa', e };
}

function vistaCampo() {
  const filtro = sessionStorage.getItem('filtroBarrio') || '';
  const q = sessionStorage.getItem('busqueda') || '';
  const vs = S.viviendas.filter(v => (!filtro || v.barrio === filtro) && (!q || `${v.direccion} ${v.propietario} ${v.id}`.toLowerCase().includes(q.toLowerCase())));
  const pend = S.viviendas.filter(v => !ultimaDe(v.id)).length;
  const curso = S.viviendas.filter(v => { const e = ultimaDe(v.id); return e && e.estado !== 'firmada'; }).length;
  const firm = S.viviendas.length - pend - curso;
  const orden = { alta: 0, media: 1, normal: 2 };
  vs.sort((a, b) => (!!ultimaDe(a.id) - !!ultimaDe(b.id)) || orden[a.prioridad] - orden[b.prioridad]);
  marco('campo', `
    <h1>Edificaciones asignadas</h1>
    <p class="sub">Toca una edificación para evaluarla. Todo se guarda en el celular y se sube solo cuando hay señal.</p>
    <div class="kpis"><div class="kpi"><b>${pend}</b><small>Pendientes</small></div><div class="kpi"><b>${curso}</b><small>En curso</small></div><div class="kpi"><b>${firm}</b><small>Firmadas</small></div><div class="kpi"><b>${pendientesSync()}</b><small>Por subir</small></div></div>
    <div class="card"><div class="grid2">
      <label class="campo">Buscar<input type="text" id="busca" value="${esc(q)}" placeholder="Dirección, propietario o código"></label>
      <label class="campo">Barrio<select id="barrio">${opciones(BARRIOS.map(b => [b.n, b.n]), filtro, 'Todos los barrios')}</select></label>
    </div></div>
    <div class="lista">${vs.map(v => { const st = estadoVivienda(v); return `<a class="item" href="#/evaluar/${v.id}" style="text-decoration:none;color:inherit">
      <span class="dot" style="background:${st.c}"></span>
      <div><b>${esc(v.direccion)}</b><small>${esc(v.barrio)} · ${esc(v.propietario)} · <span class="mono">${v.id}</span></small></div>
      <div style="text-align:right"><span class="tag ${v.prioridad}">${v.prioridad === 'alta' ? 'Prioridad alta' : v.prioridad === 'media' ? 'Prioridad media' : 'Normal'}</span><br><small>${esc(st.t)}</small></div></a>`; }).join('') || '<p class="vacio">No hay edificaciones con ese filtro.</p>'}</div>`);
  $('#busca').addEventListener('input', e => { sessionStorage.setItem('busqueda', e.target.value); clearTimeout(vistaCampo.t); vistaCampo.t = setTimeout(() => { vistaCampo(); const b = $('#busca'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 350); });
  $('#barrio').addEventListener('change', e => { sessionStorage.setItem('filtroBarrio', e.target.value); vistaCampo(); });
}

/* ---------------- evaluar ---------------- */
const leer = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const poner = (o, p, v) => { const ks = p.split('.'), u = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[u] = v; };

async function vistaEvaluar(vid) {
  const v = S.viviendas.find(x => x.id === vid);
  if (!v) { location.hash = '#/campo'; return; }
  let ev = evDe(vid);
  if (!ev) {
    ev = nuevaEvaluacion(v, { nombre: S.sesion.nombre, profesion: S.sesion.profesion, matricula: S.sesion.matricula, rupe: S.sesion.rupe, perfil: S.sesion.perfil });
    await guardarEv(ev);
  }
  if (ev.estado === 'firmada') { location.hash = `#/concepto/${ev.id}`; return; }
  const puedeFirmarRol = ROLES[S.sesion.rol].firma;
  if (puedeFirmarRol) ev.evaluador = { nombre: S.sesion.nombre, profesion: S.sesion.profesion, matricula: S.sesion.matricula, rupe: S.sesion.rupe, perfil: S.sesion.perfil };

  const campo = (k, lbl, tipo = 'text', extra = '') => `<label class="campo">${lbl}<input type="${tipo}" data-k="${k}" value="${esc(leer(ev, k))}" ${extra}></label>`;
  const sel = (k, lbl, lista) => `<label class="campo">${lbl}<select data-k="${k}">${opciones(lista, leer(ev, k))}</select></label>`;

  marco('campo', `
    <p style="margin:14px 0 0"><a href="#/campo">← Volver a la lista</a></p>
    <h1>${esc(v.direccion)}</h1>
    <p class="sub">${esc(v.barrio)} · ${esc(v.propietario)} · <span class="mono">${v.id}</span> · ${esc(v.reporte)}</p>
    <div class="prog" id="prog"></div>

    <section class="card"><div class="ceja">1 · Ubicación</div>
      <div class="fila"><button class="btn" id="bGps">📍 Tomar ubicación GPS en sitio</button><span id="gpsTxt" class="mono"></span></div>
    </section>

    <section class="card"><div class="ceja">2 · Edificación</div><div class="grid2">
      ${sel('edificacion.uso', 'Uso', USOS)}${sel('edificacion.sistema', 'Sistema estructural', SISTEMAS)}
      ${campo('edificacion.pisos', 'Número de pisos', 'number', 'min="1" max="20"')}${campo('edificacion.hogares', 'Hogares que la habitan', 'number', 'min="0" max="50"')}
    </div><label class="chk"><input type="checkbox" data-k="edificacion.sotano" ${ev.edificacion.sotano ? 'checked' : ''}> Tiene sótano o semisótano</label></section>

    <section class="card"><div class="ceja">3 · Condiciones observadas</div>
      ${CONDICIONES.map(c => `<div class="cond"><b>${c.t}</b><small>${c.ayuda}</small><div class="nivel" data-cond="${c.id}">${NIVELES.map(n => `<button type="button" data-v="${n}" class="${ev.condiciones[c.id] === n ? 'on' : ''}">${NIVEL_TXT[n]}</button>`).join('')}</div></div>`).join('')}
      <label class="campo" style="margin-top:10px">Observaciones<textarea data-k="observaciones" placeholder="Lo que vio en sitio y no está arriba">${esc(ev.observaciones)}</textarea></label>
    </section>

    <section class="card"><div class="ceja">4 · Fotografías guiadas</div>
      <p class="sub" style="margin-bottom:10px">Cada foto queda marcada con fecha, hora y coordenadas.</p>
      <div class="fotos">${FOTOS_GUIADAS.map(f => `<div class="foto ${ev.fotos[f.id] ? 'ok' : ''}" data-foto="${f.id}">${ev.fotos[f.id] ? `<img src="${ev.fotos[f.id]}" alt="">` : '<div style="height:120px;display:flex;align-items:center;justify-content:center;font-size:30px;color:var(--mut)">📷</div>'}<div class="t">${f.t}<small>${f.ayuda}</small></div><label><input type="file" accept="image/*" capture="environment" data-foto-in="${f.id}"></label></div>`).join('')}</div>
    </section>

    <section class="card"><div class="ceja">5 · Hogar (para el RUD)</div><div class="grid2">
      ${campo('hogar.jefe', 'Jefe de hogar')}${campo('hogar.documento', 'Documento de identidad', 'text', 'inputmode="numeric"')}
      ${campo('hogar.telefono', 'Teléfono / WhatsApp', 'tel')}${campo('hogar.personas', 'Personas en el hogar', 'number', 'min="0"')}
      ${campo('hogar.menores', 'Menores de edad', 'number', 'min="0"')}${campo('hogar.mayores', 'Adultos mayores', 'number', 'min="0"')}
      ${campo('hogar.discapacidad', 'Personas con discapacidad', 'number', 'min="0"')}${sel('hogar.etnia', 'Autorreconocimiento étnico', ETNIAS)}
      ${sel('hogar.zona', 'Zona', [['urbana', 'Urbana'], ['rural', 'Rural dispersa']])}${sel('hogar.tenencia', 'Tenencia de la vivienda', TENENCIAS)}
    </div><label class="chk"><input type="checkbox" data-k="hogar.consentimiento" ${ev.hogar.consentimiento ? 'checked' : ''}> El jefe de hogar autoriza el tratamiento de sus datos personales para la atención de la emergencia y el Registro Único de Damnificados (Ley 1581 de 2012).</label></section>

    <section class="card agente"><div class="ceja" style="color:#7ddcff">6 · Agente Axiona · Claude de Anthropic</div>
      <h2>Revisión inteligente de la evaluación</h2>
      <p class="sub" style="color:#b9d2e3">El agente analiza las fotos y el formulario, avisa qué falta, detecta inconsistencias y sugiere el cartel con su justificación. <b style="color:#fff">El cartel lo decides y firmas tú.</b></p>
      <button class="btn pri" id="bAgente">✦ Revisar con el Agente Axiona</button>
      <div id="agenteOut"></div>
    </section>

    <section class="card"><div class="ceja">7 · Decisión del evaluador</div>
      <div class="carteles">${Object.entries(CARTELES).map(([k, c]) => `<button type="button" data-c="${k}" class="${ev.decision.cartel === k ? 'on' : ''}">${c.corto}<br><small style="font-weight:500">${c.nombre.split('· ')[1]}</small></button>`).join('')}</div>
      <p class="leyenda" id="cartelTxt">${ev.decision.cartel ? esc(CARTELES[ev.decision.cartel].texto) : 'Selecciona el cartel según tu criterio profesional.'}</p>
      <label class="campo">Restricciones de uso<textarea data-k="decision.restricciones" placeholder="Zonas que no se pueden ocupar, condiciones de ingreso…">${esc(ev.decision.restricciones)}</textarea></label>
      <label class="campo" style="margin-top:8px">Justificación del evaluador (opcional)<textarea data-k="decision.justificacion" placeholder="Por qué asignas este cartel">${esc(ev.decision.justificacion)}</textarea></label>
      <label class="chk"><input type="checkbox" id="chkFase2" ${ev.decision.fase2 ? 'checked' : ''} disabled> Remitida a fase 2 (automático con amarillo o rojo)</label>
      <label class="chk"><input type="checkbox" data-k="decision.apuntalar" ${ev.decision.apuntalar ? 'checked' : ''}> Requiere apuntalamiento o medidas de emergencia</label>
      <label class="chk"><input type="checkbox" data-k="decision.evacuar" ${ev.decision.evacuar ? 'checked' : ''}> Se recomienda evacuación</label>
    </section>

    <section class="card"><div class="ceja">8 · Firma</div>
      ${puedeFirmarRol ? `<p class="sub">Firma como <b>${esc(S.sesion.nombre)}</b> · ${esc(S.sesion.profesion)} · Matrícula ${esc(S.sesion.matricula)} · ${esc(S.sesion.rupe)} · Perfil ${esc(S.sesion.perfil)}</p>
        <canvas class="firma" id="firma"></canvas><div class="fila" style="margin-top:8px"><button class="btn sm" id="bLimpiar" type="button">Borrar firma</button></div>
        <div id="faltan"></div>` : `<p class="sub">Tu rol (${esc(ROLES[S.sesion.rol].n)}) no firma. Cuando termines, entrégala al evaluador habilitado.</p><div id="faltan"></div>`}
    </section>
    <div class="pie-fijo"><div class="in"><span class="mono" id="guardado">Guardado en el equipo</span><div class="esp"></div>
      ${puedeFirmarRol ? '<button class="btn pri" id="bFirmar">Firmar concepto</button>' : '<button class="btn pri" id="bEntregar">Entregar al evaluador</button>'}</div></div>`);

  let firma = null;
  if (puedeFirmarRol) { firma = lienzoFirma($('#firma')); $('#bLimpiar').onclick = () => firma.limpiar(); }

  const pintarProg = () => {
    const pasos = [ev.ubicacion.gps, !!ev.edificacion.sistema, true, !!ev.fotos.fachada, !!ev.hogar.consentimiento, !!ev.agente, !!ev.decision.cartel, false];
    $('#prog').innerHTML = pasos.map(p => `<i class="${p ? 'ok' : ''}"></i>`).join('');
    const f = faltantes(ev);
    $('#faltan').innerHTML = f.length ? `<div class="aviso">Para firmar falta: <ul class="limpia">${f.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<div class="aviso ok">La evaluación está completa.</div>';
    $('#gpsTxt').textContent = ev.ubicacion.gps ? `${ev.ubicacion.lat}, ${ev.ubicacion.lon} · ±${ev.ubicacion.precision ?? '?'} m` : 'Aún sin ubicación tomada en sitio';
  };
  let tGuardar;
  const guardarLuego = () => { $('#guardado').textContent = 'Guardando…'; clearTimeout(tGuardar); tGuardar = setTimeout(async () => { await guardarEv(ev); $('#guardado').textContent = 'Guardado en el equipo · ' + new Date().toLocaleTimeString('es-CO'); }, 400); pintarProg(); };

  en('input', e => { const k = e.target.dataset.k; if (!k || e.target.type === 'checkbox') return; poner(ev, k, e.target.type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value); guardarLuego(); });
  en('change', e => { const k = e.target.dataset.k; if (k && e.target.type === 'checkbox') { poner(ev, k, e.target.checked); guardarLuego(); } if (k && e.target.tagName === 'SELECT') { poner(ev, k, e.target.value); guardarLuego(); } });
  en('click', e => {
    const n = e.target.closest('.nivel button');
    if (n) { const c = n.parentElement.dataset.cond; ev.condiciones[c] = n.dataset.v; n.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === n)); guardarLuego(); return; }
    const c = e.target.closest('.carteles button');
    if (c) {
      ev.decision.cartel = c.dataset.c; ev.decision.fase2 = c.dataset.c !== 'verde';
      document.querySelectorAll('.carteles button').forEach(b => b.classList.toggle('on', b === c));
      $('#chkFase2').checked = ev.decision.fase2; $('#cartelTxt').textContent = CARTELES[c.dataset.c].texto;
      if (ev.agente && ev.agente.cartel !== c.dataset.c) toast('Tu decisión difiere de la sugerencia del agente: queda registrada.');
      guardarLuego();
    }
    if (e.target.id === 'bUsarRestr' && ev.agente) { ev.decision.restricciones = ev.agente.restricciones || ''; $('[data-k="decision.restricciones"]').value = ev.decision.restricciones; guardarLuego(); }
  });
  en('change', async e => {
    const id = e.target.dataset.fotoIn; if (!id || !e.target.files?.[0]) return;
    const caja = e.target.closest('.foto'); caja.querySelector('.t').insertAdjacentHTML('beforeend', '<small>Procesando…</small>');
    const sello = `${v.id} · ${new Date().toLocaleString('es-CO')} · ${ev.ubicacion.gps ? `${ev.ubicacion.lat}, ${ev.ubicacion.lon}` : 'sin GPS'}`;
    ev.fotos[id] = await prepararFoto(e.target.files[0], sello);
    caja.classList.add('ok');
    caja.querySelector('img, div')?.remove();
    caja.insertAdjacentHTML('afterbegin', `<img src="${ev.fotos[id]}" alt="">`);
    caja.querySelector('.t small:last-child')?.remove();
    guardarLuego();
  });
  $('#bGps').onclick = async () => {
    $('#gpsTxt').textContent = 'Buscando señal GPS…';
    try { const u = await ubicar(); ev.ubicacion = { ...ev.ubicacion, ...u }; guardarLuego(); toast(`Ubicación tomada (±${u.precision} m).`); }
    catch (er) { toast(er.message, 4000); pintarProg(); }
  };
  $('#bAgente').onclick = async () => {
    const b = $('#bAgente'); b.disabled = true; b.textContent = '✦ El Agente Axiona está revisando…';
    $('#agenteOut').innerHTML = '<p class="sub" style="color:#b9d2e3;margin-top:12px">Analizando fotografías y formulario…</p>';
    const res = await consultarAgente(ev);
    ev.agente = res; await guardarEv(ev);
    b.disabled = false; b.textContent = '✦ Revisar de nuevo';
    pintarAgente(); pintarProg();
  };
  const pintarAgente = () => {
    const a = ev.agente; if (!a) return;
    const c = CARTELES[a.cartel];
    $('#agenteOut').innerHTML = `${a.aviso ? `<div class="aviso">${esc(a.aviso)}</div>` : ''}
      <div class="sugerencia"><span class="sello" style="background:${c?.color}">Sugerencia: ${c?.corto}</span><span class="mono" style="color:#9fc3d8">${a.origen === 'claude' ? `Claude · confianza ${esc(a.confianza)}` : 'Reglas sin conexión'}</span></div>
      <p style="color:#e3eef6">${esc(a.justificacion)}</p>
      ${a.hallazgos?.length ? `<b>En las fotos</b><ul class="limpia">${a.hallazgos.map(h => `<li><b>${esc(h.foto)}:</b> ${esc(h.observacion)}</li>`).join('')}</ul>` : ''}
      ${a.faltantes?.length ? `<div class="aviso">Falta: <ul class="limpia">${a.faltantes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${a.inconsistencias?.length ? `<div class="aviso rojo">Inconsistencias: <ul class="limpia">${a.inconsistencias.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${a.restricciones ? `<p><b>Restricciones sugeridas:</b> ${esc(a.restricciones)} <button class="btn sm" id="bUsarRestr" type="button">Usar</button></p>` : ''}
      ${a.recomendaciones?.length ? `<b>Recomendaciones</b><ul class="limpia">${a.recomendaciones.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${a.borrador ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600">Borrador de concepto técnico</summary><p style="white-space:pre-wrap;color:#d6e6f1">${esc(a.borrador)}</p></details>` : ''}`;
  };
  pintarAgente(); pintarProg();

  const bF = $('#bFirmar');
  if (bF) bF.onclick = async () => {
    const f = faltantes(ev);
    if (f.length) return toast('Antes de firmar: ' + f[0]);
    if (firma.vacia()) return toast('Falta tu firma en el recuadro.');
    if (!confirm(`¿Firmar el concepto con cartel ${CARTELES[ev.decision.cartel].corto}? Un concepto firmado no se edita: los cambios se hacen con una nueva versión.`)) return;
    ev.firma = firma.imagen(); ev.estado = 'firmada'; ev.firmada = new Date().toISOString(); ev.version = (ev.version || 1) + 1; ev.sincronizada = false;
    ev.decision.coincideAgente = ev.agente ? ev.agente.cartel === ev.decision.cartel : null;
    await guardarEv(ev);
    toast('Concepto firmado.');
    sincronizar();
    location.hash = `#/concepto/${ev.id}`;
  };
  const bE = $('#bEntregar');
  if (bE) bE.onclick = async () => {
    ev.estado = 'lista'; ev.version = (ev.version || 1) + 1; ev.sincronizada = false; ev.preparadaPor = S.sesion.nombre;
    await guardarEv(ev); toast('Entregada al evaluador.'); sincronizar(); location.hash = '#/campo';
  };
}

/* ---------------- concepto ---------------- */
async function vistaConcepto(id) {
  let ev = S.evs.get(id);
  if (!ev && navigator.onLine) {
    try { const r = await fetch(`/api/sync?id=${encodeURIComponent(id)}`, { headers: { 'x-acceso': S.sesion.pin } }); if (r.ok) { ev = await r.json(); await guardarEv(ev); } } catch { /* sin datos */ }
  }
  if (!ev) { marco('campo', '<p class="vacio">No se encontró el concepto.</p>'); return; }
  const c = CARTELES[ev.decision.cartel] || {};
  const fotos = FOTOS_GUIADAS.filter(f => ev.fotos?.[f.id]);
  const corregir = ev.revision?.estado === 'devuelta' && S.sesion.rol === 'evaluador' && !ev.demo;
  marco('campo', `<div class="fila no-print" style="margin-top:14px"><a href="#/campo" class="btn sm">← Lista</a><button class="btn sm pri" id="bImprimir">Imprimir / Guardar PDF</button>${corregir ? '<button class="btn sm oro" id="bCorregir">Corregir (nueva versión)</button>' : ''}</div>
  ${ev.revision?.estado === 'devuelta' ? `<div class="aviso rojo no-print">Devuelto por ${esc(ev.revision.por)}: ${esc(ev.revision.nota)}</div>` : ''}
  <article class="concepto">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:2px solid #0b1f33;padding-bottom:12px">
      <div><div style="font:700 11px var(--fm);letter-spacing:.12em;color:#0e7fa8">ALCALDÍA DE QUIBDÓ · AXIONA EVALÚA</div><h2 style="margin:6px 0 0">Concepto técnico · Fase 1</h2><div style="font-size:12px;color:#55636f">Inspección visual rápida · Circular Conjunta 73 de 2026 (UNGRD–IDIGER)</div></div>
      <div style="text-align:right"><span class="cartelc" style="background:${c.color};color:${ev.decision.cartel === 'rojo' ? '#fff' : '#06110a'}">${esc(c.nombre || 'Sin cartel')}</span><div class="mono" style="margin-top:6px;color:#55636f">${esc(ev.id)}${ev.demo ? ' · DEMOSTRACIÓN' : ''}</div></div>
    </div>
    <table style="margin-top:12px"><tr><th>Dirección</th><td>${esc(ev.edificacion.direccion)} · ${esc(ev.edificacion.barrio)}</td></tr>
      <tr><th>Ubicación</th><td>${ev.ubicacion.lat}, ${ev.ubicacion.lon}${ev.ubicacion.precision ? ` (±${ev.ubicacion.precision} m)` : ''}</td></tr>
      <tr><th>Edificación</th><td>${esc((SISTEMAS.find(s => s[0] === ev.edificacion.sistema) || [, ''])[1])} · ${ev.edificacion.pisos} piso(s) · uso ${esc(ev.edificacion.uso)} · ${ev.edificacion.hogares} hogar(es)</td></tr>
      <tr><th>Restricciones</th><td>${esc(ev.decision.restricciones || 'Ninguna')}</td></tr>
      <tr><th>Medidas</th><td>Fase 2: ${ev.decision.fase2 ? 'Sí' : 'No'} · Apuntalamiento: ${ev.decision.apuntalar ? 'Sí' : 'No'} · Evacuación: ${ev.decision.evacuar ? 'Sí' : 'No'}</td></tr>
      ${ev.decision.justificacion ? `<tr><th>Justificación</th><td>${esc(ev.decision.justificacion)}</td></tr>` : ''}
      <tr><th>Condiciones</th><td>${CONDICIONES.filter(k => ev.condiciones?.[k.id] && ev.condiciones[k.id] !== 'ninguno').map(k => `${esc(k.t)}: ${NIVEL_TXT[ev.condiciones[k.id]]}`).join(' · ') || 'Sin daños marcados'}</td></tr>
      <tr><th>Hogar</th><td>${esc(ev.hogar.jefe)} · ${ev.hogar.personas || 0} persona(s)${ev.hogar.documento ? ` · Doc. ${esc(ev.hogar.documento)}` : ''}</td></tr>
    </table>
    ${ev.agente ? `<h3 style="font-family:Georgia,serif;color:#0b1f33">Revisión del Agente Axiona (${ev.agente.origen === 'claude' ? 'Claude de Anthropic' : 'reglas sin conexión'})</h3>
      <p style="font-size:13px">Sugerencia: <b>${esc(CARTELES[ev.agente.cartel]?.corto)}</b> · ${esc(ev.agente.justificacion)}</p>
      <p style="font-size:12px;color:#55636f">${ev.decision.coincideAgente === false ? 'El evaluador asignó un cartel distinto al sugerido por el agente.' : 'El cartel asignado coincide con la sugerencia del agente.'} La clasificación es juicio del evaluador.</p>` : ''}
    ${fotos.length ? `<h3 style="font-family:Georgia,serif;color:#0b1f33">Registro fotográfico</h3><div class="fotosc">${fotos.map(f => `<figure style="margin:0"><img src="${ev.fotos[f.id]}" alt=""><figcaption style="font-size:11px;color:#55636f">${f.t}</figcaption></figure>`).join('')}</div>` : ''}
    <div style="display:flex;gap:20px;align-items:flex-end;margin-top:20px">
      <div>${ev.firma ? `<img src="${ev.firma}" alt="Firma" style="height:70px;display:block">` : '<div style="height:70px"></div>'}<div style="border-top:1px solid #0b1f33;padding-top:4px;font-size:12px;min-width:240px"><b>${esc(ev.evaluador?.nombre)}</b><br>${esc(ev.evaluador?.profesion || '')} · Matrícula ${esc(ev.evaluador?.matricula)} · ${esc(ev.evaluador?.rupe)} · Perfil ${esc(ev.evaluador?.perfil || '')}</div></div>
      <div style="font-size:12px;color:#55636f">Firmado: ${fecha(ev.firmada)}<br>Revisión: ${esc(ev.revision?.estado || 'pendiente')}</div>
    </div>
    <p style="font-size:10.5px;color:#7a8794;margin-top:16px">Concepto de fase 1 (inspección visual rápida). El cartel rojo no es una orden de demolición. Los carteles amarillo y rojo requieren evaluación detallada (fase 2). Datos personales tratados conforme a la Ley 1581 de 2012. Generado con AXIONA EVALÚA · Axiona Desarrollos Inteligentes.</p>
  </article>`);
  $('#bImprimir').onclick = () => print();
  const bc = $('#bCorregir');
  if (bc) bc.onclick = async () => {
    ev.estado = 'borrador'; ev.firma = null; ev.firmada = null; ev.version = (ev.version || 1) + 1; ev.sincronizada = false;
    ev.historial = [...(ev.historial || []), { version: ev.version - 1, revision: ev.revision, fecha: new Date().toISOString() }];
    ev.revision = { estado: 'pendiente', nota: '', por: '', fecha: null };
    await guardarEv(ev); location.hash = `#/evaluar/${ev.viviendaId}`;
  };
}

/* ---------------- tablero ---------------- */
async function vistaTablero() {
  await sincronizar();
  const ultimas = S.viviendas.map(v => ({ v, e: ultimaDe(v.id) }));
  const firm = ultimas.filter(x => x.e?.estado === 'firmada');
  const cuenta = k => firm.filter(x => x.e.decision.cartel === k).length;
  const conAg = firm.filter(x => typeof x.e.decision.coincideAgente === 'boolean');
  const coinc = conAg.length ? Math.round(100 * conAg.filter(x => x.e.decision.coincideAgente).length / conAg.length) : null;
  const porBarrio = BARRIOS.map(b => { const l = ultimas.filter(x => x.v.barrio === b.n); return { b: b.n, t: l.length, f: l.filter(x => x.e?.estado === 'firmada').length, v: l.filter(x => x.e?.decision?.cartel === 'verde' && x.e.estado === 'firmada').length, a: l.filter(x => x.e?.decision?.cartel === 'amarillo' && x.e.estado === 'firmada').length, r: l.filter(x => x.e?.decision?.cartel === 'rojo' && x.e.estado === 'firmada').length }; });
  const evs = [...new Map([...S.remotas.values(), ...S.evs.values()].map(e => [e.id, e])).values()].filter(e => ['firmada', 'lista'].includes(e.estado)).sort((a, b) => (b.actualizada || '').localeCompare(a.actualizada || ''));
  const coord = ['coordinacion', 'despacho'].includes(S.sesion.rol);
  marco('tablero', `
    <h1>Tablero de mando · Quibdó</h1>
    <p class="sub">Avance de la evaluación de edificaciones (fase 1). ${S.ultimaSync ? `Actualizado con el servidor a las ${S.ultimaSync.toLocaleTimeString('es-CO')}.` : 'Datos de este equipo (sin conexión con el servidor).'}</p>
    <div class="kpis">
      <div class="kpi"><b>${S.viviendas.length}</b><small>Edificaciones en el listado</small></div>
      <div class="kpi"><b>${firm.length}</b><small>Con concepto firmado</small></div>
      <div class="kpi"><b>${S.viviendas.length - firm.length}</b><small>Pendientes</small></div>
      <div class="kpi"><b>${coinc === null ? '—' : coinc + ' %'}</b><small>Coincidencia agente–evaluador</small></div>
    </div>
    <div class="kpis">
      <div class="kpi"><b style="color:var(--verde)">${cuenta('verde')}</b><small>Verde · inspeccionada</small></div>
      <div class="kpi"><b style="color:var(--amarillo)">${cuenta('amarillo')}</b><small>Amarillo · uso restringido</small></div>
      <div class="kpi"><b style="color:var(--rojo)">${cuenta('rojo')}</b><small>Rojo · inseguro</small></div>
      <div class="kpi"><b>${firm.filter(x => x.e.decision.fase2).length}</b><small>Remitidas a fase 2</small></div>
    </div>
    <div class="card"><div id="mapa"></div><p class="leyenda">● gris pendiente · ● morado en curso · ● azul lista para firma · ● verde, amarillo y rojo según el cartel. Ubicaciones de demostración.</p></div>
    <div class="card"><h2>Avance por barrio</h2><div class="tbl"><table><tr><th>Barrio</th><th>Avance</th><th>Firmadas</th><th>Verde</th><th>Amarillo</th><th>Rojo</th></tr>
      ${porBarrio.map(p => `<tr><td>${esc(p.b)}</td><td style="min-width:120px"><div class="barra"><i style="width:${100 * p.v / p.t}%;background:var(--verde)"></i><i style="width:${100 * p.a / p.t}%;background:var(--amarillo)"></i><i style="width:${100 * p.r / p.t}%;background:var(--rojo)"></i></div></td><td>${p.f}/${p.t}</td><td>${p.v}</td><td>${p.a}</td><td>${p.r}</td></tr>`).join('')}</table></div></div>
    <div class="card"><h2>Exportar</h2><p class="sub">Consolidado de conceptos firmados, en formato abierto (CSV, se abre en Excel) para el EDAN y el RUD.</p>
      <div class="fila"><button class="btn" id="xEdan">⬇ Consolidado EDAN</button><button class="btn" id="xRud">⬇ Hogares para RUD</button><button class="btn" id="xSync">⟳ Sincronizar ahora</button></div></div>
    <div class="card"><h2>Conceptos recientes</h2><div class="tbl"><table><tr><th>Edificación</th><th>Cartel</th><th>Evaluador</th><th>Fecha</th><th>Revisión</th><th></th></tr>
      ${evs.slice(0, 40).map(e => `<tr><td>${esc(e.edificacion.direccion)}<br><small class="mono">${esc(e.edificacion.barrio)} · ${esc(e.viviendaId)}</small></td>
        <td>${e.estado === 'lista' ? '<span class="tag">Lista para firma</span>' : `<span class="tag" style="border-color:${CARTELES[e.decision.cartel]?.color};color:${CARTELES[e.decision.cartel]?.color}">${CARTELES[e.decision.cartel]?.corto || '—'}</span>`}</td>
        <td>${esc(e.evaluador?.nombre || e.preparadaPor || '')}</td><td>${fecha(e.firmada || e.actualizada)}</td>
        <td>${esc(e.revision?.estado || 'pendiente')}${e.revision?.nota ? `<br><small>${esc(e.revision.nota)}</small>` : ''}</td>
        <td style="white-space:nowrap">${e.estado === 'firmada' ? `<a class="btn sm" href="#/concepto/${e.id}">Ver</a>` : ''}
          ${coord && e.estado === 'firmada' && e.revision?.estado !== 'aprobada' ? `<button class="btn sm" data-aprobar="${e.id}">Aprobar</button><button class="btn sm peligro" data-devolver="${e.id}">Devolver</button>` : ''}
          ${S.sesion.rol === 'evaluador' && e.estado === 'lista' ? `<button class="btn sm pri" data-tomar="${e.id}">Revisar y firmar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="vacio">Aún no hay conceptos.</td></tr>'}</table></div></div>`);

  const color = e => !e ? '#6b7683' : e.estado === 'firmada' ? CARTELES[e.decision.cartel]?.color || '#6b7683' : e.estado === 'lista' ? '#3ccbf4' : '#a78bfa';
  if (S.mapa) { S.mapa.remove(); S.mapa = null; }
  S.mapa = L.map('mapa', { zoomControl: true, attributionControl: true }).setView([CENTRO.lat, CENTRO.lon], 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(S.mapa);
  ultimas.forEach(({ v, e }) => L.circleMarker([e?.ubicacion?.lat || v.lat, e?.ubicacion?.lon || v.lon], { radius: 7, color: '#0b1118', weight: 1.5, fillColor: color(e), fillOpacity: .95 })
    .bindPopup(`<b>${esc(v.direccion)}</b><br>${esc(v.barrio)} · ${v.id}<br>${e?.estado === 'firmada' ? `Cartel ${CARTELES[e.decision.cartel]?.corto} · ${esc(e.evaluador?.nombre || '')}${e.id ? `<br><a href="#/concepto/${e.id}">Ver concepto</a>` : ''}` : e ? 'En curso' : 'Pendiente'}`).addTo(S.mapa));
  setTimeout(() => S.mapa?.invalidateSize(), 120);

  const todas = () => [...new Map([...S.remotas.values(), ...S.evs.values()].map(e => [e.id, e])).values()];
  $('#xEdan').onclick = () => descargar(`EDAN_Quibdo_${new Date().toISOString().slice(0, 10)}.csv`, csvEDAN(todas()));
  $('#xRud').onclick = () => descargar(`RUD_hogares_Quibdo_${new Date().toISOString().slice(0, 10)}.csv`, csvRUD(todas()));
  $('#xSync').onclick = () => sincronizar(true).then(vistaTablero);
  en('click', async e => {
    const ap = e.target.dataset.aprobar, dv = e.target.dataset.devolver, tm = e.target.dataset.tomar;
    const id = ap || dv || tm; if (!id) return;
    let ev = S.evs.get(id);
    if (!ev && navigator.onLine) { const r = await fetch(`/api/sync?id=${encodeURIComponent(id)}`, { headers: { 'x-acceso': S.sesion.pin } }); if (r.ok) ev = await r.json(); }
    if (!ev) return toast('No se pudo abrir la evaluación.');
    if (tm) { await guardarEv(ev); location.hash = `#/evaluar/${ev.viviendaId}`; return; }
    const nota = dv ? prompt('¿Qué debe corregir el evaluador?') : '';
    if (dv && !nota) return;
    ev.revision = { estado: ap ? 'aprobada' : 'devuelta', nota: nota || '', por: S.sesion.nombre, fecha: new Date().toISOString() };
    ev.version = (ev.version || 1) + 1; ev.sincronizada = false;
    await guardarEv(ev); await sincronizar(); toast(ap ? 'Concepto aprobado.' : 'Concepto devuelto con observaciones.'); vistaTablero();
  });
}

/* ---------------- ayuda ---------------- */
function vistaAyuda() {
  marco('ayuda', `<h1>Cómo funciona AXIONA EVALÚA</h1>
  <div class="card"><div class="ceja">Flujo de una visita</div><ol class="limpia">
    <li>Elige la edificación en <b>Campo</b> y toma la ubicación GPS en sitio.</li>
    <li>Diligencia la edificación, las condiciones observadas y las fotos guiadas (quedan con fecha, hora y coordenadas).</li>
    <li>Registra el hogar con su consentimiento (Ley 1581): son los datos que alimentan el RUD.</li>
    <li>Pide la revisión del <b>Agente Axiona</b>. Con señal usa Claude de Anthropic; sin señal, reglas de respaldo.</li>
    <li>Asigna el cartel según tu criterio, escribe las restricciones y firma. El concepto firmado no se edita.</li>
    <li>Con señal, todo sube solo al tablero de la Alcaldía. Coordinación aprueba o devuelve con observaciones.</li></ol></div>
  <div class="card"><div class="ceja">Carteles · Circular Conjunta 73 de 2026</div>${Object.values(CARTELES).map(c => `<p><span class="sello" style="background:${c.color}">${c.nombre}</span> ${esc(c.texto)}</p>`).join('')}</div>
  <div class="card"><div class="ceja">Sin internet</div><p>La app se instala en el celular (menú del navegador → «Agregar a la pantalla de inicio») y funciona sin señal. El mapa conserva las zonas que ya se vieron con conexión.</p></div>
  <div class="card"><div class="ceja">Versión de demostración</div><p>Los datos del listado son ficticios. Los formularios oficiales se configuran con los instrumentos que entregue la Alcaldía conforme a la Circular 73.</p>
    <button class="btn peligro" id="bReiniciar">Reiniciar datos de demostración</button></div>
  <p class="leyenda">Axiona Desarrollos Inteligentes · axionadesarrollos@gmail.com · +57 310 392 2935 · axionasoft.com</p>`);
  $('#bReiniciar').onclick = async () => {
    if (!confirm('Se borran las evaluaciones de este equipo y se recargan los datos de demostración.')) return;
    await A.vaciar('evaluaciones'); await A.vaciar('viviendas'); S.evs.clear(); await cargar(); toast('Datos de demostración recargados.'); location.hash = '#/campo';
  };
}

/* ---------------- rutas ---------------- */
async function ruta() {
  S.ctl.abort(); S.ctl = new AbortController();
  if (!S.sesion) return vistaIngreso();
  const [, r, id] = (location.hash || '#/campo').split('/');
  if (S.mapa && r !== 'tablero') { S.mapa.remove(); S.mapa = null; }
  window.scrollTo(0, 0);
  if (r === 'salir') { S.sesion = null; await A.ajuste('sesion', null); location.hash = ''; return vistaIngreso(); }
  if (r === 'evaluar' && id) return vistaEvaluar(id);
  if (r === 'concepto' && id) return vistaConcepto(id);
  if (r === 'tablero') return vistaTablero();
  if (r === 'ayuda') return vistaAyuda();
  return vistaCampo();
}

(async function iniciar() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  await cargar();
  S.sesion = await A.ajuste('sesion') || null;
  if (S.sesion) ponerPin(S.sesion.pin);
  addEventListener('hashchange', ruta);
  await ruta();
  if (S.sesion) sincronizar();
})();
