// Mapa: el sismo, los predios y los sismos recientes, con capas que se prenden y apagan.
import { $, esc, ICON } from '../ui/base.js';
import { S, prediosCiudad } from '../nucleo/estado.js';
import { CIUDADES } from '../nucleo/ciudades.js';
import { crearMapa, ponerPredios, ponerSismos, visible } from '../mapa/mapa.js';
import { puntaje } from '../nucleo/prioridad.js';
import { sismosRecientes } from '../nucleo/red.js';

export async function render(main) {
  const C = CIUDADES[S.ciudad], pro = S.modo === 'pro';
  main.innerHTML = `<div class="cabecera"><div><h1>Mapa · ${esc(C.nombre)}</h1><p class="sub">OpenStreetMap propio (funciona sin señal si lo descargó) con el ShakeMap del sismo.</p></div>
    <div class="opcs" id="capas">${[['mmi', 'Intensidad (MMI)', true], ['dyfi', '¿Lo sintió? (DYFI)', false], ['predios', pro ? 'Cola de evaluación' : 'Mis casas', true], ['recientes', 'Sismos recientes', true]].map(([k, t, on]) => `<label><input type="checkbox" data-c="${k}" ${on ? 'checked' : ''}>${t}</label>`).join('')}</div></div>
    <div id="mapa" class="mapa alto" style="margin-top:12px"></div>
    <div class="leyenda">${pro ? '<span><i style="background:#ff5b6e"></i>Urgente</span><span><i style="background:#ff8a3d"></i>Alta</span><span><i style="background:#ffc857"></i>Media</span><span><i style="background:#5ad1ff"></i>Normal</span>' : '<span><i style="background:#ff5b6e"></i>Alerta</span><span><i style="background:#ffb547"></i>Revisión</span><span><i style="background:#3ad29f"></i>Sin señales graves</span>'}<span><i style="background:#ff9f43"></i>Sismo reciente</span><span id="fuentes" class="tenue"></span></div>`;
  const mapa = await crearMapa($('#mapa', main), { ciudad: S.ciudad });
  const lista = (pro ? prediosCiudad() : prediosCiudad().filter(p => !p.demo)).map(p => {
    const r = pro ? puntaje(p, { pesos: S.ajustes.pesos, fragilidad: S.ajustes.fragilidad }) : null;
    return { id: p.id, lat: p.ubicacion.lat, lon: p.ubicacion.lon, nivel: pro ? r.banda.id : p.orientacion?.nivel, titulo: p.ubicacion.direccion };
  });
  ponerPredios(mapa, lista, { alTocar: id => { location.hash = `#/expediente/${id}`; } });
  let vivo = true; // si la persona sale del mapa antes de que lleguen los sismos, no se toca un mapa ya cerrado
  sismosRecientes().then(d => {
    if (!vivo) return;
    if (!d?.eventos) { $('#fuentes', main).textContent = 'Sismos recientes: sin conexión'; return; }
    ponerSismos(mapa, d.eventos);
    $('#fuentes', main).textContent = `${d.eventos.length} sismos desde el 10-ago · fuentes: ${d.fuentes.map(f => `${f.id} ${f.ok ? '✓' : '✗'}`).join(' · ')}`;
  });
  $('#capas', main).addEventListener('change', e => { const k = e.target.dataset.c; if (!k) return; visible(mapa, k, e.target.checked); if (k === 'mmi') visible(mapa, 'mmi-txt', e.target.checked); });
  return () => { vivo = false; mapa.remove(); };
}
export { ICON };
