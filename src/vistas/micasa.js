// Mi casa: las viviendas que esta familia reportó desde este teléfono.
import { esc, ICON, fechaCorta } from '../ui/base.js';
import { S, misPredios } from '../nucleo/estado.js';
import { ESTADOS } from '../nucleo/predio.js';
import { CIUDADES } from '../nucleo/ciudades.js';

export async function render(main) {
  const mias = misPredios();
  main.innerHTML = `
  <div class="cabecera"><div><h1>Mi casa</h1><p class="sub">Sus reportes se guardan en este teléfono y se envían cuando hay señal.</p></div>
  <a class="btn pri grande" href="#/reportar">${ICON.casa} Reportar una vivienda</a></div>
  ${mias.length ? `<div class="lista" style="margin-top:16px">${mias.map(p => {
    const n = p.orientacion?.nivel || 'sin_senales';
    return `<a class="item" href="#/expediente/${p.id}"><span class="p ${n === 'alerta' ? 'urgente' : n === 'revision' ? 'alta' : 'normal'}">${ICON.casa}</span>
      <span><b>${esc(p.ubicacion.direccion || 'Sin dirección')}</b><small>${esc(CIUDADES[p.ciudad].nombre)} · ${esc(p.id)} · ${esc(ESTADOS[p.estado] || p.estado)} · ${fechaCorta(p.actualizado)}</small></span>
      <span class="tag ${n}">${n === 'alerta' ? 'Alerta' : n === 'revision' ? 'Revisión' : 'Sin señales graves'}</span></a>`;
  }).join('')}</div>`
    : `<div class="card vacio" style="margin-top:16px"><div style="font-size:42px">🏠</div><h3>Aún no ha reportado ninguna vivienda</h3><p class="sub">En unos 5 minutos: ubicación, señales de peligro, fotos y, si quiere, mediciones de grietas. Funciona sin internet.</p><a class="btn pri" href="#/reportar">Empezar el reporte</a></div>`}
  <div class="rejilla" style="margin-top:16px">
    <a class="card" href="#/tarjeta" style="text-decoration:none;color:inherit"><h3>${ICON.regla} Tarjeta-regla</h3><p class="sub">Imprímala para medir el ancho de las grietas en milímetros con la cámara.</p></a>
    <a class="card" href="#/derechos" style="text-decoration:none;color:inherit"><h3>${ICON.balanza} Mis derechos</h3><p class="sub">Arriendo, registro de damnificados, licencias, derecho de petición y tutela.</p></a>
  </div>
  <p class="tenue" style="margin-top:14px">Ciudad actual: ${esc(CIUDADES[S.ciudad].nombre)}. Cámbiela arriba si reporta en la otra ciudad.</p>`;
}
