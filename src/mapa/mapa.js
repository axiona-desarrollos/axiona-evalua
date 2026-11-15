/* ==========================================================================
   AXIONA EVALÚA · Mapa (MapLibre + PMTiles propios, sin servidor de terceros)
   --------------------------------------------------------------------------
   - Base: extractos de OpenStreetMap (Protomaps, ODbL) de Quibdó y Pereira y
     un regional de baja resolución, servidos desde este mismo sitio. Al
     «descargar el mapa», el archivo queda en el teléfono (Cache Storage) y el
     service worker responde las peticiones por rangos sin señal.
   - Capas del sismo: contornos de intensidad (ShakeMap), «¿Lo sintió?» (DYFI),
     epicentro, sismos recientes (SGC/USGS) y los predios.
   Atribución visible de OpenStreetMap y Protomaps, como exige la licencia.
   ========================================================================== */
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import { CIUDADES } from '../nucleo/ciudades.js';

let protocolo = null;
const abs = p => location.origin + p; // sin codificar: MapLibre necesita las llaves {fontstack} y {range}

function estilo(ciudad) {
  const sabor = { ...namedFlavor('dark'), background: '#070b12', earth: '#0c1420', water: '#0a2238', buildings: '#16202d' };
  const base = (fuente, rango) => layers(fuente, sabor, { lang: 'es' }).map(l => ({ ...l, id: `${fuente}-${l.id}`, ...(l.source ? rango : {}) }));
  const capas = [
    ...base('region', { maxzoom: 10.5 }).filter(l => l.type !== 'background' || l.id === 'region-background'),
    ...base('ciudad', { minzoom: 10.5 }).filter(l => l.type !== 'background'),
  ];
  return {
    version: 8,
    glyphs: abs('/mapa/fuentes/{fontstack}/{range}.pbf'),
    sprite: abs('/mapa/sprites/dark'),
    sources: {
      region: { type: 'vector', url: `pmtiles://${abs('/mapa/region.pmtiles')}`, attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>' },
      ciudad: { type: 'vector', url: `pmtiles://${abs('/' + CIUDADES[ciudad].mapa)}` },
    },
    layers: capas,
  };
}

const COLORES_MMI = { 4: '#7fd1ff', 5: '#7cf3c4', 6: '#f6e05e', 7: '#f6a03b', 8: '#ef5a3a', 9: '#c21f4a' };
export const COLOR_NIVEL = { alerta: '#ff5b6e', revision: '#ffb547', sin_senales: '#3ad29f', urgente: '#ff5b6e', alta: '#ff8a3d', media: '#ffc857', normal: '#5ad1ff' };

/**
 * Crea el mapa.
 * @param {HTMLElement} el
 * @param {object} o { ciudad, sismo (bool), interactivo, alElegir(lngLat) }
 */
export async function crearMapa(el, o = {}) {
  if (!protocolo) { protocolo = new Protocol(); maplibregl.addProtocol('pmtiles', protocolo.tile); }
  const C = CIUDADES[o.ciudad || 'quibdo'];
  const mapa = new maplibregl.Map({
    container: el, style: estilo(C.id), center: [o.centro?.lon ?? C.centro.lon, o.centro?.lat ?? C.centro.lat], zoom: o.zoom ?? C.zoom,
    attributionControl: { compact: true }, maxZoom: 18.5, minZoom: 5, dragRotate: false, pitchWithRotate: false, cooperativeGestures: !!o.cooperativo,
  });
  mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  if (o.ubicarme !== false) mapa.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');
  await new Promise(ok => mapa.once('load', ok));
  if (o.sismo !== false) await capasSismo(mapa);
  if (o.alElegir) {
    let marca = null;
    const poner = ll => { if (!marca) marca = new maplibregl.Marker({ color: '#19d3c5', draggable: true }).setLngLat(ll).addTo(mapa); else marca.setLngLat(ll); marca.on('dragend', () => o.alElegir(marca.getLngLat())); };
    mapa.on('click', e => { poner(e.lngLat); o.alElegir(e.lngLat); });
    mapa.ponerMarca = (lat, lon) => poner([lon, lat]);
  }
  return mapa;
}

async function capasSismo(mapa) {
  const [cont, dyfi, ev] = await Promise.all(['/sismo/cont_mmi.json', '/sismo/dyfi10.geojson', '/sismo/evento.json'].map(u => fetch(u).then(r => r.json()).catch(() => null)));
  if (dyfi) {
    mapa.addSource('dyfi', { type: 'geojson', data: dyfi });
    mapa.addLayer({ id: 'dyfi', type: 'fill', source: 'dyfi', layout: { visibility: 'none' }, paint: { 'fill-opacity': 0.35, 'fill-color': ['interpolate', ['linear'], ['get', 'cdi'], 3, '#7fd1ff', 5, '#7cf3c4', 6, '#f6e05e', 7, '#f6a03b', 8, '#ef5a3a', 9, '#c21f4a'] } });
  }
  if (cont) {
    mapa.addSource('mmi', { type: 'geojson', data: cont });
    mapa.addLayer({ id: 'mmi', type: 'line', source: 'mmi', paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 12, 3], 'line-opacity': 0.85, 'line-color': ['match', ['to-number', ['get', 'value']], ...Object.entries(COLORES_MMI).flatMap(([k, c]) => [+k, c]), '#9fb3c8'] } });
    mapa.addLayer({ id: 'mmi-txt', type: 'symbol', source: 'mmi', layout: { 'symbol-placement': 'line', 'text-field': ['concat', 'MMI ', ['to-string', ['get', 'value']]], 'text-font': ['Noto Sans Medium'], 'text-size': 11 }, paint: { 'text-color': '#dfe9f5', 'text-halo-color': '#070b12', 'text-halo-width': 1.4 } });
  }
  if (ev) {
    mapa.addSource('epicentro', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [ev.lon, ev.lat] }, properties: { t: `Epicentro M${ev.mag}` } } });
    mapa.addLayer({ id: 'epi-halo', type: 'circle', source: 'epicentro', paint: { 'circle-radius': 16, 'circle-color': '#ff5b6e', 'circle-opacity': 0.18, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ff5b6e' } });
    mapa.addLayer({ id: 'epi', type: 'circle', source: 'epicentro', paint: { 'circle-radius': 5, 'circle-color': '#ff5b6e' } });
    mapa.addLayer({ id: 'epi-txt', type: 'symbol', source: 'epicentro', layout: { 'text-field': ['get', 't'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-offset': [0, 1.8] }, paint: { 'text-color': '#ffd1d6', 'text-halo-color': '#070b12', 'text-halo-width': 1.4 } });
  }
}

/** Pone o actualiza los predios en el mapa (color por nivel o banda). */
export function ponerPredios(mapa, lista, { alTocar } = {}) {
  const data = { type: 'FeatureCollection', features: lista.filter(p => p.lat !== null && p.lat !== undefined).map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { id: p.id, color: COLOR_NIVEL[p.nivel] || '#9fb3c8', t: p.titulo || p.id } })) };
  if (mapa.getSource('predios')) { mapa.getSource('predios').setData(data); return; }
  mapa.addSource('predios', { type: 'geojson', data });
  mapa.addLayer({ id: 'predios', type: 'circle', source: 'predios', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 9], 'circle-color': ['get', 'color'], 'circle-stroke-color': '#05080d', 'circle-stroke-width': 1.5 } });
  if (alTocar) {
    mapa.on('click', 'predios', e => alTocar(e.features[0].properties.id));
    mapa.on('mouseenter', 'predios', () => { mapa.getCanvas().style.cursor = 'pointer'; });
    mapa.on('mouseleave', 'predios', () => { mapa.getCanvas().style.cursor = ''; });
  }
}

/** Sismos recientes (de /api/sismos). */
export function ponerSismos(mapa, eventos = []) {
  const data = { type: 'FeatureCollection', features: eventos.filter(e => e.lat).map(e => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.lon, e.lat] }, properties: { mag: e.mag || 0, t: `M${(e.mag || 0).toFixed(1)}` } })) };
  if (mapa.getSource('recientes')) { mapa.getSource('recientes').setData(data); return; }
  mapa.addSource('recientes', { type: 'geojson', data });
  mapa.addLayer({ id: 'recientes', type: 'circle', source: 'recientes', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 3, 5, 9, 7.5, 18], 'circle-color': '#ff9f43', 'circle-opacity': 0.55, 'circle-stroke-color': '#ffcf99', 'circle-stroke-width': 1 } });
}

export const visible = (mapa, capa, si) => { if (mapa.getLayer(capa)) mapa.setLayoutProperty(capa, 'visibility', si ? 'visible' : 'none'); };

/* ----------------------------- sin conexión ----------------------------- */
const CACHE = 'axiona-mapas-v1';
export const archivosCiudad = ciudad => ['/mapa/region.pmtiles', '/' + CIUDADES[ciudad].mapa, '/' + CIUDADES[ciudad].sismo, '/sismo/cont_mmi.json', '/sismo/dyfi10.geojson', '/sismo/evento.json'];

export async function mapaDescargado(ciudad) {
  if (!('caches' in window)) return false;
  const c = await caches.open(CACHE);
  for (const u of archivosCiudad(ciudad)) if (!(await c.match(u))) return false;
  return true;
}

/** Descarga los archivos del mapa y del sismo de la ciudad (≈ 4–8 MB) al teléfono. */
export async function descargarMapa(ciudad, alAvanzar = () => {}) {
  const c = await caches.open(CACHE), lista = archivosCiudad(ciudad);
  let i = 0;
  for (const u of lista) {
    const r = await fetch(u, { cache: 'reload' });
    if (!r.ok) throw new Error(`No se pudo descargar ${u}`);
    await c.put(u, r);
    alAvanzar(++i / lista.length);
  }
  return true;
}
