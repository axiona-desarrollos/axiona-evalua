/* ==========================================================================
   AXIONA EVALÚA · Geometría en la Tierra
   --------------------------------------------------------------------------
   Funciones puras (sin DOM) para distancias, mallas y polígonos. Las mallas
   del ShakeMap y de falla del terreno vienen recortadas por
   scripts/datos_sismo.py con este formato:
     { lon0, lat0 (esquina NOROESTE, centro del primer nodo), dlon, dlat,
       nlon, nlat, valores | campos[nombre] } ; fila 0 = latitud mayor.
   ========================================================================== */

const R_TIERRA = 6371008.8; // radio medio (m), IUGG
const rad = g => g * Math.PI / 180;

/** Distancia por el círculo máximo (haversine), en metros. */
export function distancia(a, b) {
  const dφ = rad(b.lat - a.lat), dλ = rad(b.lon - a.lon);
  const s = Math.sin(dφ / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dλ / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Rumbo inicial de a hacia b, en grados desde el norte (0–360). */
export function rumbo(a, b) {
  const φ1 = rad(a.lat), φ2 = rad(b.lat), dλ = rad(b.lon - a.lon);
  const y = Math.sin(dλ) * Math.cos(φ2), x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** Distancia hipocentral (m): epicentral y profundidad combinadas. */
export const distanciaHipocentral = (sitio, ev) => Math.hypot(distancia(sitio, ev), (ev.profundidadKm || 0) * 1000);

/**
 * Interpolación bilineal en una malla regular. Si alguno de los cuatro nodos
 * no tiene dato (null), se usa el promedio ponderado de los que sí tienen; si
 * ninguno tiene, devuelve null. Fuera de la malla devuelve null.
 * @param {object} m   malla
 * @param {number[]} v valores (fila por fila, de norte a sur y de oeste a este)
 */
export function bilineal(m, v, lon, lat) {
  const fx = (lon - m.lon0) / m.dlon, fy = (m.lat0 - lat) / m.dlat;
  if (!(fx >= 0 && fy >= 0 && fx <= m.nlon - 1 && fy <= m.nlat - 1)) return null;
  const x0 = Math.min(Math.floor(fx), m.nlon - 2), y0 = Math.min(Math.floor(fy), m.nlat - 2);
  const tx = fx - x0, ty = fy - y0;
  const nodos = [[x0, y0, (1 - tx) * (1 - ty)], [x0 + 1, y0, tx * (1 - ty)], [x0, y0 + 1, (1 - tx) * ty], [x0 + 1, y0 + 1, tx * ty]];
  let s = 0, p = 0;
  for (const [x, y, w] of nodos) {
    const val = v[y * m.nlon + x];
    if (val === null || val === undefined || Number.isNaN(val)) continue;
    s += val * w; p += w;
  }
  return p > 1e-12 ? s / p : null;
}

/** Punto en polígono (anillo [[lon, lat], ...]) por cruce de rayos. */
export function puntoEnPoligono(lon, lat, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** ¿Está el punto dentro de la caja [lon0, lat0, lon1, lat1]? */
export const enCaja = (p, c) => p.lon >= c[0] && p.lon <= c[2] && p.lat >= c[1] && p.lat <= c[3];

/** Coordenadas legibles: 5,6947° N · 76,6582° O */
export function coordTexto(p) {
  if (!p || p.lat === undefined) return '';
  const f = (v, pos, neg) => `${Math.abs(v).toFixed(5).replace('.', ',')}° ${v >= 0 ? pos : neg}`;
  return `${f(p.lat, 'N', 'S')} · ${f(p.lon, 'E', 'O')}`;
}
