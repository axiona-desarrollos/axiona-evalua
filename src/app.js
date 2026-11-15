/* ==========================================================================
   AXIONA EVALÚA · Aplicación unificada
   --------------------------------------------------------------------------
   Una sola app con dos puertas sobre el mismo expediente por predio:
   - Mi casa (ciudadano): reporte guiado, mediciones con el celular, derechos
     y seguimiento. Sin carteles oficiales.
   - Axiona Pro (profesional): cola priorizada, evaluación Circular 73,
     levantamiento con Axiona Topo, diseño y presupuesto con Axiona Obra,
     expediente y exportaciones.
   Quibdó y Pereira. Funciona sin internet. Axiona Desarrollos Inteligentes.
   ========================================================================== */
import './ui/estilos.css';
import { $, esc, ICON, toast } from './ui/base.js';
import { S, iniciarEstado, guardarGeneral } from './nucleo/estado.js';
import { CIUDADES, LISTA_CIUDADES } from './nucleo/ciudades.js';
import { ponerPin } from './nucleo/red.js';

const RUTAS = [
  [/^\/?$/, () => import('./vistas/inicio.js')],
  [/^\/micasa$/, () => import('./vistas/micasa.js')],
  [/^\/reportar(?:\/([\w-]+))?$/, () => import('./vistas/reportar.js')],
  [/^\/expediente\/([\w-]+)$/, () => import('./vistas/expediente.js')],
  [/^\/medir\/grieta\/([\w-]+)$/, () => import('./vistas/medirGrieta.js')],
  [/^\/medir\/inclinacion\/([\w-]+)$/, () => import('./vistas/medirInclinacion.js')],
  [/^\/derechos(?:\/([\w-]+))?$/, () => import('./vistas/derechos.js')],
  [/^\/mapa$/, () => import('./vistas/mapa.js')],
  [/^\/tarjeta$/, () => import('./vistas/tarjeta.js')],
  [/^\/pro$/, () => import('./vistas/pro.js')],
  [/^\/pro\/tablero$/, () => import('./vistas/tablero.js')],
  [/^\/pro\/ajustes$/, () => import('./vistas/ajustes.js')],
  [/^\/pro\/evaluar\/([\w-]+)$/, () => import('./vistas/evaluar.js')],
  [/^\/acerca$/, () => import('./vistas/acerca.js')],
];

let limpiar = null;

function shell() {
  const pro = S.modo === 'pro';
  document.body.classList.toggle('pro', pro);
  const nav = pro
    ? [['#/pro', ICON.lista, 'Cola'], ['#/mapa', ICON.mapa, 'Mapa'], ['#/pro/tablero', ICON.tablero, 'Tablero'], ['#/derechos', ICON.balanza, 'Derechos'], ['#/pro/ajustes', ICON.ajustes, 'Ajustes']]
    : [['#/', ICON.casa, 'Inicio'], ['#/micasa', ICON.casco, 'Mi casa'], ['#/derechos', ICON.balanza, 'Derechos'], ['#/mapa', ICON.mapa, 'Mapa']];
  $('#app').innerHTML = `
  <header class="barra">
    <a class="marca" href="#/" aria-label="Inicio"><i>A</i><span><b>AXIONA EVALÚA</b><small>Reconstrucción post-sismo</small></span></a>
    <nav class="nav" aria-label="Principal">${nav.map(([h, ic, t]) => `<a href="${h}">${ic}<span>${t}</span></a>`).join('')}</nav>
    <span class="espacio"></span>
    <div class="ciudades" role="group" aria-label="Ciudad">${LISTA_CIUDADES.map(c => `<button data-ciudad="${c.id}" aria-pressed="${c.id === S.ciudad}">${esc(c.nombre)}</button>`).join('')}</div>
    <button class="modo ${pro ? 'pro' : ''}" id="cambiarModo" title="Cambiar entre ciudadano y profesional">${pro ? ICON.casco : ICON.persona}<span>${pro ? 'Pro' : 'Ciudadano'}</span></button>
    <i class="red ${navigator.onLine ? '' : 'off'}" id="red" title="${navigator.onLine ? 'Con conexión' : 'Sin conexión: todo se guarda en el teléfono'}"></i>
  </header>
  <main id="vista"></main>`;
  $('.ciudades').addEventListener('click', e => {
    const b = e.target.closest('[data-ciudad]');
    if (!b || b.dataset.ciudad === S.ciudad) return;
    S.ciudad = b.dataset.ciudad; guardarGeneral(); shell(); ir();
    toast(`Ciudad: ${CIUDADES[S.ciudad].nombre}`);
  });
  $('#cambiarModo').onclick = async () => {
    if (S.modo === 'pro') { S.modo = 'ciudadano'; guardarGeneral(); location.hash = '#/'; shell(); ir(); return; }
    const { pedirPin } = await import('./vistas/pin.js');
    if (await pedirPin()) { S.modo = 'pro'; guardarGeneral(); location.hash = '#/pro'; shell(); ir(); }
  };
}

function marcarNav() {
  const h = location.hash || '#/';
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    a.toggleAttribute('aria-current', href === h || (href !== '#/' && h.startsWith(href) && !(href === '#/pro' && h.startsWith('#/pro/'))));
    if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
  });
}

async function ir() {
  const ruta = (location.hash || '#/').slice(1).split('?')[0];
  try { limpiar?.(); } catch { /* */ }
  limpiar = null;
  const viejo = $('#vista');
  if (!viejo) return;
  // un <main> nuevo por vista: los escuchadores de la vista anterior no sobreviven
  const main = viejo.cloneNode(false);
  viejo.replaceWith(main);
  for (const [re, carga] of RUTAS) {
    const m = re.exec(ruta);
    if (!m) continue;
    main.innerHTML = '<div class="vacio"><span class="cargando"></span></div>';
    try {
      const mod = await carga();
      limpiar = await mod.render(main, ...m.slice(1)) || null;
    } catch (e) {
      console.error(e);
      main.innerHTML = `<div class="card"><h2>Algo salió mal</h2><p class="sub">${esc(e.message)}</p><a class="btn" href="#/">Volver al inicio</a></div>`;
    }
    marcarNav();
    window.scrollTo(0, 0);
    return;
  }
  main.innerHTML = '<div class="card"><h2>Página no encontrada</h2><a class="btn" href="#/">Ir al inicio</a></div>';
}

async function arrancar() {
  await iniciarEstado();
  try { const p = sessionStorage.getItem('axiona-pin'); if (p) { ponerPin(p); S.pin = p; } } catch { /* */ }
  if (S.modo === 'pro' && !S.pin) S.modo = 'ciudadano';
  shell();
  addEventListener('hashchange', ir);
  addEventListener('axiona:modo', e => { S.modo = e.detail; guardarGeneral(); shell(); ir(); });
  addEventListener('online', () => import('./nucleo/sync.js').then(m => m.enviarPendientes()));
  import('./nucleo/sync.js').then(m => m.enviarPendientes());
  addEventListener('online', () => { const r = $('#red'); if (r) { r.classList.remove('off'); r.title = 'Con conexión'; } });
  addEventListener('offline', () => { const r = $('#red'); if (r) { r.classList.add('off'); r.title = 'Sin conexión: todo se guarda en el teléfono'; } });
  await ir();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
}

arrancar().catch(e => { $('#app').innerHTML = `<main><div class="card"><h2>No se pudo iniciar</h2><p class="sub">${esc(e.message)}</p></div></main>`; });
