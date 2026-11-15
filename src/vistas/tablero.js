// Tablero de mando: avance, distribución del daño y exportaciones.
import { $, esc, ICON, num, descargarBlob } from '../ui/base.js';
import { S, prediosCiudad } from '../nucleo/estado.js';
import { CIUDADES } from '../nucleo/ciudades.js';
import { ordenarCola } from '../nucleo/prioridad.js';
import { ESTADOS } from '../nucleo/predio.js';
import { CARTELES } from '../evaluacion/formulario.js';
import { csvEDAN, csvRUD, aCSV } from '../evaluacion/exportar.js';
import * as A from '../nucleo/almacen.js';
import { barras } from '../ui/graficas.js';

export async function render(main) {
  const C = CIUDADES[S.ciudad];
  const ps = prediosCiudad();
  const ord = ordenarCola(ps, { pesos: S.ajustes.pesos, fragilidad: S.ajustes.fragilidad });
  const porEstado = Object.keys(ESTADOS).map(k => [ESTADOS[k], ps.filter(p => p.estado === k).length]);
  const porBanda = ['urgente', 'alta', 'media', 'normal'].map(b => [b, ord.filter(x => x.r.banda.id === b).length]);
  const carteles = Object.keys(CARTELES).map(k => [CARTELES[k].corto, ps.filter(p => p.evaluacionResumen?.cartel === k).length, CARTELES[k].color]);
  const barrios = {};
  for (const { p, r } of ord) { const b = p.ubicacion.barrio || 'Sin barrio'; barrios[b] = barrios[b] || { n: 0, s: 0, u: 0 }; barrios[b].n++; barrios[b].s += r.puntaje; if (r.banda.id === 'urgente') barrios[b].u++; }
  const top = Object.entries(barrios).sort((a, b) => b[1].s / b[1].n - a[1].s / a[1].n).slice(0, 10);
  const personas = ps.reduce((s, p) => s + (+p.hogar.personas || 0), 0);
  const evs = await A.todos('evaluaciones');
  main.innerHTML = `<div class="cabecera"><div><h1>Tablero · ${esc(C.nombre)}</h1><p class="sub">${ps.filter(p => p.demo).length ? 'Incluye datos de demostración.' : ''}</p></div></div>
  <div class="datos" style="margin:12px 0"><div class="dato"><span>Viviendas</span><b>${ps.length}</b></div><div class="dato"><span>Personas</span><b>${num(personas, 0)}</b></div><div class="dato"><span>Urgentes</span><b style="color:var(--rojo)">${porBanda[0][1]}</b></div><div class="dato"><span>Evaluadas</span><b>${carteles.reduce((s, c) => s + c[1], 0)}</b></div><div class="dato"><span>Con levantamiento</span><b>${ps.filter(p => p.topo).length}</b></div><div class="dato"><span>Con diseño</span><b>${ps.filter(p => p.obra).length}</b></div></div>
  <div class="rejilla">
    <div class="card"><h3>Prioridad</h3>${barras(porBanda.map(([b, n]) => [b, n, ps.length || 1, n]))}</div>
    <div class="card"><h3>Estado del proceso</h3>${barras(porEstado.filter(x => x[1]).map(([t, n]) => [t, n, ps.length || 1, n]))}</div>
    <div class="card"><h3>Carteles (Circular 73)</h3>${barras(carteles.map(([t, n]) => [t, n, Math.max(1, ...carteles.map(c => c[1])), n]))}</div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Barrios con mayor prioridad promedio</h3><table class="tabla"><tr><th>Barrio</th><th>Viviendas</th><th>Urgentes</th><th>Prioridad media</th></tr>${top.map(([b, v]) => `<tr><td>${esc(b)}</td><td>${v.n}</td><td>${v.u}</td><td>${num(v.s / v.n, 0)}</td></tr>`).join('')}</table></div>
  <div class="card" style="margin-top:14px"><h3>Exportar</h3><div class="fila" style="margin-top:8px"><button class="btn" id="edan">${ICON.descargar} EDAN (firmadas)</button><button class="btn" id="rud">${ICON.descargar} RUD (firmadas)</button><button class="btn" id="cola">${ICON.descargar} Cola priorizada (CSV)</button><button class="btn" id="geo">${ICON.descargar} GeoJSON</button></div>
    <p class="tenue" style="margin-top:6px">${evs.filter(e => e.estado === 'firmada').length} evaluaciones firmadas en este equipo. Columnas de trabajo hasta que la UNGRD defina el formato de cargue oficial.</p></div>`;
  $('#edan', main).onclick = () => descargarBlob(`EDAN_${C.id}.csv`, new Blob([csvEDAN(evs)], { type: 'text/csv' }));
  $('#rud', main).onclick = () => descargarBlob(`RUD_${C.id}.csv`, new Blob([csvRUD(evs)], { type: 'text/csv' }));
  $('#cola', main).onclick = () => descargarBlob(`cola_${C.id}.csv`, new Blob([aCSV(['Código', 'Prioridad', 'Banda', 'Estado', 'Barrio', 'Dirección', 'Latitud', 'Longitud', 'MMI', 'Personas', 'Demo'], ord.map(({ p, r }) => [p.id, r.puntaje, r.banda.n, ESTADOS[p.estado], p.ubicacion.barrio, p.ubicacion.direccion, p.ubicacion.lat, p.ubicacion.lon, p.sismo?.mmi ?? '', p.hogar.personas, p.demo ? 'sí' : '']))], { type: 'text/csv' }));
  $('#geo', main).onclick = () => descargarBlob(`predios_${C.id}.geojson`, new Blob([JSON.stringify({ type: 'FeatureCollection', features: ord.filter(x => x.p.ubicacion.lat !== null).map(({ p, r }) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.ubicacion.lon, p.ubicacion.lat] }, properties: { id: p.id, prioridad: r.puntaje, banda: r.banda.id, estado: p.estado, barrio: p.ubicacion.barrio, mmi: p.sismo?.mmi, cartel: p.evaluacionResumen?.cartel || null, demo: !!p.demo } })) })], { type: 'application/geo+json' }));
}
