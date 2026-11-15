// Inicio: las dos puertas, el sismo en la ciudad y el mapa sin conexión.
import { esc, ICON, num, toast } from '../ui/base.js';
import { S, cargarMalla, misPredios } from '../nucleo/estado.js';
import { CIUDADES } from '../nucleo/ciudades.js';
import { sismoEnSitio, textoMMI } from '../sismo/sitio.js';
import { distancia } from '../nucleo/geo.js';
import { mapaDescargado, descargarMapa } from '../mapa/mapa.js';
import { textoFecha, deISO, hoyColombia, diasEntre } from '../nucleo/calendario.js';
import { vigencias } from '../derechos/motor.js';

export async function render(main) {
  const C = CIUDADES[S.ciudad];
  const [malla, ev] = await Promise.all([cargarMalla(S.ciudad), fetch('/sismo/evento.json').then(r => r.json()).catch(() => null)]);
  const s = malla && sismoEnSitio(malla, C.centro);
  const m = s ? textoMMI(s.mmi) : null;
  const dEpi = ev ? distancia(C.centro, ev) / 1000 : null;
  const mias = misPredios().filter(p => p.ciudad === S.ciudad);
  const V = vigencias(S.ajustes.fechas), hoy = hoyColombia();
  const diasArriendo = diasEntre(hoy, V.arriendoHasta);
  main.innerHTML = `
  <section class="heroe">
    <span class="eyebrow">${ICON.ondas} Sismo del 10 de agosto de 2026 · ${esc(C.nombre)}</span>
    <h1>Su casa después del sismo,<br>en una sola app.</h1>
    <p>Reporte su vivienda, mida las grietas con el celular, conozca sus derechos con la norma citada y siga su caso hasta la reparación. Los profesionales evalúan, miden el lote, diseñan y presupuestan sobre el mismo expediente.</p>
    <div class="puertas">
      <a class="puerta" href="#/micasa"><span class="ir">${ICON.flecha}</span><div class="ico">${ICON.casa}</div><h2>Mi casa</h2><p class="sub">Para las familias. Gratis y sin cuenta.</p>
        <ul><li>Reporte guiado con fotos y ubicación</li><li>Medir grietas y desplomes con el celular</li><li>Qué hacer ya y a quién acudir</li><li>Pedir la evaluación profesional</li></ul></a>
      <a class="puerta pro" href="#/pro" id="puertaPro"><span class="ir">${ICON.flecha}</span><div class="ico">${ICON.casco}</div><h2>Axiona Pro</h2><p class="sub">Para evaluadores del RUPE, alcaldías y constructoras.</p>
        <ul><li>Cola priorizada por riesgo y vulnerabilidad</li><li>Evaluación Circular 73 con el Agente Axiona</li><li>Topógrafo, planos, 3D y presupuesto</li><li>Expediente para licencia y subsidio</li></ul></a>
    </div>
  </section>

  <div class="rejilla" style="margin-top:16px">
    <div class="card">
      <div class="fila entre"><h3>El sismo en ${esc(C.nombre)}</h3><a class="btn sm" href="#/mapa">${ICON.mapa} Ver mapa</a></div>
      ${s ? `<div class="datos" style="margin-top:10px">
        <div class="dato"><span>Intensidad estimada</span><b>${m.romano}</b><small>${esc(m.sacudida)} · MMI ${num(s.mmi)}</small></div>
        <div class="dato"><span>Aceleración del suelo</span><b>${num(s.pga)} %g</b><small>PGA, centro urbano</small></div>
        <div class="dato"><span>Del epicentro</span><b>${num(dEpi, 0)} km</b><small>${ev ? `M${ev.mag} · ${num(ev.profundidadKm, 0)} km de prof.` : ''}</small></div>
      </div>
      <p class="tenue" style="margin-top:10px">Estimación regional del ShakeMap de la USGS (evento ${ev?.id || ''}). Fuente oficial en Colombia: Servicio Geológico Colombiano. En su predio la app calcula el valor exacto.</p>` : '<p class="sub">Sin datos del sismo para esta ciudad.</p>'}
    </div>
    <div class="card">
      <h3>Lo urgente</h3>
      <div class="pila" style="margin-top:8px">
        <a class="item" href="#/reportar"><span class="p normal">${ICON.casa}</span><span><b>Reportar mi casa</b><small>5 minutos · funciona sin señal</small></span>${ICON.flecha}</a>
        <a class="item" href="#/derechos"><span class="p media">${ICON.balanza}</span><span><b>Mis derechos</b><small>${diasArriendo > 0 ? `Medidas de arriendo: quedan ~${diasArriendo} días` : 'Arriendo, RUD, licencias, petición'}</small></span>${ICON.flecha}</a>
        <a class="item" href="#/tarjeta"><span class="p normal">${ICON.regla}</span><span><b>Tarjeta-regla para grietas</b><small>Imprímala y mida en milímetros</small></span>${ICON.flecha}</a>
      </div>
    </div>
    <div class="card" id="cardMapa">
      <h3>Mapa sin conexión</h3>
      <p class="sub">Descargue el mapa de ${esc(C.nombre)} y los datos del sismo (unos ${S.ciudad === 'pereira' ? 8 : 5} MB) para usar la app sin señal.</p>
      <div class="fila" id="estadoMapa"><span class="cargando"></span></div>
    </div>
  </div>
  ${mias.length ? `<div class="card" style="margin-top:14px"><div class="fila entre"><h3>Mis casas reportadas</h3><a class="btn sm" href="#/micasa">Ver todas</a></div><div class="lista" style="margin-top:8px">${mias.slice(0, 3).map(p => `<a class="item" href="#/expediente/${p.id}"><span class="p ${p.orientacion?.nivel === 'alerta' ? 'urgente' : p.orientacion?.nivel === 'revision' ? 'alta' : 'normal'}">${ICON.casa}</span><span><b>${esc(p.ubicacion.direccion || p.id)}</b><small>${esc(p.id)} · ${esc(p.estado)}</small></span>${ICON.flecha}</a>`).join('')}</div></div>` : ''}
  <div class="aviso" style="margin-top:14px">${ICON.info}<span>AXIONA EVALÚA orienta y documenta. La clasificación oficial de una edificación (carteles verde, amarillo o rojo) la hace un profesional inscrito en el RUPE según la Circular UNGRD 73 de 2026. Medidas legales vigentes al ${esc(textoFecha(hoy, false))}; información general, no asesoría jurídica.</span></div>
  <p class="tenue" style="text-align:center;margin-top:18px"><a href="#/acerca">Cómo funciona, fuentes y ecuaciones</a></p>`;

  const est = main.querySelector('#estadoMapa');
  const pintarMapa = async () => {
    const ok = await mapaDescargado(S.ciudad);
    est.innerHTML = ok ? `<span class="tag verde">${ICON.ok} Descargado en este teléfono</span>` : `<button class="btn pri" id="bajarMapa">${ICON.descargar} Descargar mapa de ${esc(C.nombre)}</button>`;
    const b = main.querySelector('#bajarMapa');
    if (b) b.onclick = async () => {
      b.disabled = true;
      try { await descargarMapa(S.ciudad, p => { b.textContent = `Descargando… ${Math.round(p * 100)} %`; }); toast('Mapa guardado: ya funciona sin señal.'); }
      catch (e) { toast('No se pudo descargar: ' + e.message, 3500, 'error'); }
      pintarMapa();
    };
  };
  pintarMapa();
  if (S.modo !== 'pro') main.querySelector('#puertaPro').onclick = async e => {
    e.preventDefault();
    const { pedirPin } = await import('./pin.js');
    if (await pedirPin()) { location.hash = '#/pro'; dispatchEvent(new CustomEvent('axiona:modo', { detail: 'pro' })); }
  };
}
