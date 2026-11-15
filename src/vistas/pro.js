// Axiona Pro · Cola de evaluación priorizada (local + recibida del servidor).
import { $, esc, ICON, toast, num, fechaCorta, opciones } from '../ui/base.js';
import { S, prediosCiudad, guardarPredio, derivar, cargarMalla } from '../nucleo/estado.js';
import { ordenarCola, NOMBRES_COMPONENTES } from '../nucleo/prioridad.js';
import { ESTADOS, nuevoPredio } from '../nucleo/predio.js';
import { CIUDADES } from '../nucleo/ciudades.js';
import { cola, predioRemoto } from '../nucleo/red.js';

export async function render(main) {
  if (S.modo !== 'pro') {
    const { pedirPin } = await import('./pin.js');
    if (!(await pedirPin())) { location.hash = '#/'; return; }
    dispatchEvent(new CustomEvent('axiona:modo', { detail: 'pro' }));
    return;
  }
  const C = CIUDADES[S.ciudad];
  await cargarMalla(S.ciudad);
  let filtro = { banda: '', estado: '', q: '', demo: true };
  main.innerHTML = `<div class="cabecera"><div><h1>Cola de evaluación · ${esc(C.nombre)}</h1><p class="sub">Ordenada por el puntaje de prioridad (0–100). Toque una vivienda para abrir su expediente.</p></div>
    <div class="fila"><button class="btn" id="sinc">${ICON.nube} Traer solicitudes</button><button class="btn pri" id="nueva">${ICON.casco} Registrar en campo</button></div></div>
    <div class="datos" id="kpis" style="margin:12px 0"></div>
    <div class="fila" style="margin-bottom:10px"><input id="q" placeholder="Buscar por código, barrio o dirección" style="max-width:320px">
      <select id="banda" style="max-width:170px">${opciones([['urgente', 'Urgente'], ['alta', 'Alta'], ['media', 'Media'], ['normal', 'Normal']], '', 'Toda prioridad')}</select>
      <select id="estado" style="max-width:220px">${opciones(Object.entries(ESTADOS), '', 'Todo estado')}</select>
      <label class="fila tenue"><input type="checkbox" id="demo" checked> incluir demostración</label></div>
    <div class="lista" id="lista"></div>
    <details class="saber" style="margin-top:14px"><summary>¿Cómo se calcula la prioridad?</summary><div class="formula">P = 100 · Σ wᵢ·cᵢ   (pesos editables en Ajustes; con señal grave P = 80 + 0,2·P)
${Object.entries(S.ajustes.pesos).map(([k, w]) => `${NOMBRES_COMPONENTES[k].padEnd(28)} w = ${w}`).join('\n')}
Sacudida: (MMI − 5)/3 · Terreno: máx(licuación, deslizamiento)/0,10
Daño: máx(categoría BRE/5, deriva/0,5 %) · Espera: días/30</div></details>`;

  const pintar = () => {
    const todos = prediosCiudad().filter(p => filtro.demo || !p.demo).filter(p => p.estado !== 'borrador' || p.origen === 'brigada');
    const ord = ordenarCola(todos, { pesos: S.ajustes.pesos, fragilidad: S.ajustes.fragilidad });
    const n = b => ord.filter(x => x.r.banda.id === b).length;
    $('#kpis', main).innerHTML = `<div class="dato"><span>En cola</span><b>${ord.length}</b></div><div class="dato"><span>Urgentes</span><b style="color:var(--rojo)">${n('urgente')}</b></div><div class="dato"><span>Alta</span><b style="color:#ff9c5b">${n('alta')}</b></div><div class="dato"><span>Evaluadas</span><b>${todos.filter(p => p.evaluacionResumen?.cartel).length}</b></div><div class="dato"><span>Con diseño</span><b>${todos.filter(p => p.obra).length}</b></div>`;
    const q = filtro.q.toLowerCase();
    const vis = ord.filter(({ p, r }) => (!filtro.banda || r.banda.id === filtro.banda) && (!filtro.estado || p.estado === filtro.estado) && (!q || `${p.id} ${p.ubicacion.barrio} ${p.ubicacion.direccion}`.toLowerCase().includes(q)));
    $('#lista', main).innerHTML = vis.length ? vis.slice(0, 300).map(({ p, r }) => {
      const top = Object.entries(r.aportes).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => NOMBRES_COMPONENTES[k].toLowerCase());
      return `<a class="item" href="#/expediente/${p.id}"><span class="p ${r.banda.id}">${num(r.puntaje, 0)}</span>
        <span><b>${esc(p.ubicacion.direccion || p.id)}</b><small>${esc(p.ubicacion.barrio || '')} · ${esc(p.id)} · ${esc(ESTADOS[p.estado])} · ${fechaCorta(p.creado)}${p.demo ? ' · demo' : ''}<br>Pesa más: ${esc(top.join(', '))}${p.sismo ? ` · MMI ${num(p.sismo.mmi)}` : ''}</small></span>
        <span class="tag ${r.banda.id}">${esc(r.banda.n)}</span></a>`;
    }).join('') : '<div class="vacio">Nada con esos filtros.</div>';
  };
  main.addEventListener('input', e => { if (e.target.id === 'q') { filtro.q = e.target.value; pintar(); } });
  main.addEventListener('change', e => { if (['banda', 'estado'].includes(e.target.id)) { filtro[e.target.id] = e.target.value; pintar(); } if (e.target.id === 'demo') { filtro.demo = e.target.checked; pintar(); } });
  $('#sinc', main).onclick = async () => {
    const b = $('#sinc', main); b.disabled = true;
    try {
      const d = await cola();
      let n = 0;
      for (const r of d.predios || []) {
        const local = S.predios.get(r.id);
        if (local && (local.version || 0) >= (r.version || 0)) continue;
        const full = await predioRemoto(r.id);
        derivar(full); full.sincronizado = true;
        S.predios.set(full.id, full);
        await guardarPredio(full); n++;
      }
      toast(n ? `${n} solicitud(es) nuevas o actualizadas.` : 'La cola está al día.'); pintar();
    } catch (e) { toast('No se pudo traer la cola: ' + e.message, 3500, 'error'); }
    b.disabled = false;
  };
  $('#nueva', main).onclick = async () => {
    const pr = nuevoPredio(S.ciudad, 'brigada'); pr.estado = 'asignado';
    await guardarPredio(pr, 'Registrado por la brigada en campo');
    location.hash = `#/pro/evaluar/${pr.id}`;
  };
  pintar();
}
