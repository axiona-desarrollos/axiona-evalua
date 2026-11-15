/* ==========================================================================
   AXIONA EVALÚA · El sismo en el predio
   --------------------------------------------------------------------------
   A partir de la malla del ShakeMap (USGS us6000tjl2) recortada a la ciudad,
   estima en las coordenadas del predio:
   - intensidad MMI, PGA (%g), PGV (cm/s) y PSA a 0,3 / 0,6 / 1,0 / 3,0 s;
   - Vs30 de la malla (estimado por pendiente topográfica; no reemplaza el
     estudio de suelos);
   - probabilidad de licuación (Zhu 2017) y de deslizamiento (Nowicki Jessee 2018);
   - demanda contra el espectro de diseño NSR-10 en el período aproximado
     de la edificación: r = PSA(T) / Sa(T).
   PSA(T) entre los períodos de la malla se interpola en escala log-log; por
   debajo de 0,3 s, en línea recta entre PGA (T = 0) y PSA(0,3).
   Es una estimación regional (malla de ~1 km): orienta la priorización y el
   informe técnico, no reemplaza el registro de acelerógrafos ni el análisis.
   ========================================================================== */
import { bilineal } from '../nucleo/geo.js';
import { espectro, coeficientesSitio, perfilPorVs30, periodoAproximado, sistemaPeriodo, periodos, SISTEMAS_PERIODO } from './nsr10.js';

export const PERIODOS_PSA = [[0.3, 'PSA03'], [0.6, 'PSA06'], [1.0, 'PSA10'], [3.0, 'PSA30']];

/** Valores del ShakeMap y de falla del terreno en el punto. */
export function sismoEnSitio(malla, p) {
  if (!malla || !p) return null;
  const v = {};
  for (const [k, arr] of Object.entries(malla.campos)) v[k] = bilineal(malla, arr, p.lon, p.lat);
  if (v.MMI === null) return null;
  const liq = malla.licuacion ? bilineal(malla.licuacion, malla.licuacion.valores, p.lon, p.lat) : null;
  const des = malla.deslizamiento ? bilineal(malla.deslizamiento, malla.deslizamiento.valores, p.lon, p.lat) : null;
  return {
    mmi: v.MMI, pga: v.PGA, pgv: v.PGV, psa: Object.fromEntries(PERIODOS_PSA.map(([T, k]) => [T, v[k]])), vs30: v.SVEL,
    licuacion: liq, deslizamiento: des,
  };
}

/** PSA(T) en %g interpolada desde los valores de la malla. */
export function psaEn(T, s) {
  const pts = [[0, s.pga], ...PERIODOS_PSA.map(([t]) => [t, s.psa[t]])].filter(([, a]) => a > 0);
  if (!pts.length) return null;
  if (T <= 0) return s.pga;
  if (T <= 0.3 && s.psa[0.3] > 0) return s.pga + (s.psa[0.3] - s.pga) * T / 0.3;
  const largos = pts.filter(([t]) => t > 0);
  if (T >= largos[largos.length - 1][0]) {
    // más allá de 3 s: se extrapola con la pendiente log-log del último tramo
    const [a, b] = largos.slice(-2);
    const m = Math.log(b[1] / a[1]) / Math.log(b[0] / a[0]);
    return b[1] * Math.pow(T / b[0], m);
  }
  for (let i = 0; i < largos.length - 1; i++) {
    const [t0, a0] = largos[i], [t1, a1] = largos[i + 1];
    if (T >= t0 && T <= t1) return Math.exp(Math.log(a0) + (Math.log(a1) - Math.log(a0)) * (Math.log(T) - Math.log(t0)) / (Math.log(t1) - Math.log(t0)));
  }
  return null;
}

/** Escala de intensidad (Mercalli modificada) en palabras. */
export function textoMMI(mmi) {
  const r = Math.round(mmi);
  const t = { 1: 'No sentido', 2: 'Débil', 3: 'Débil', 4: 'Ligero', 5: 'Moderado', 6: 'Fuerte', 7: 'Muy fuerte', 8: 'Severo', 9: 'Violento', 10: 'Extremo' };
  const romano = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.max(1, Math.min(10, r))];
  const dano = { 6: 'daño leve posible', 7: 'daño moderado en construcciones vulnerables', 8: 'daño considerable en construcciones vulnerables; algo de daño en las bien construidas', 9: 'daño grave', 10: 'destrucción de muchas construcciones' };
  return { romano, sacudida: t[Math.max(1, Math.min(10, r))], dano: r >= 6 ? dano[Math.min(10, r)] : 'sin daño esperado' };
}

/** Categoría de susceptibilidad a partir de la probabilidad modelada (umbral orientativo). */
export function nivelFalla(p) {
  if (p === null || p === undefined) return { nivel: 'sin dato', clase: 'gris' };
  if (p >= 0.10) return { nivel: 'alta', clase: 'alta' };
  if (p >= 0.03) return { nivel: 'media', clase: 'media' };
  if (p >= 0.005) return { nivel: 'baja', clase: 'baja' };
  return { nivel: 'muy baja', clase: 'muybaja' };
}

/**
 * Demanda del sismo contra el espectro de diseño NSR-10.
 * @param {object} s       sismoEnSitio
 * @param {object} nsr     { Aa, Av } de la ciudad
 * @param {object} o       { perfil, I, alturaM, sistema, T } (T manual si se conoce)
 */
export function demandaVsDiseno(s, nsr, o = {}) {
  if (!s || !nsr) return null;
  const perfil = o.perfil || perfilPorVs30(s.vs30) || 'D';
  const coef = coeficientesSitio(perfil, nsr.Aa, nsr.Av);
  if (!coef) return { perfil, requiereEstudio: true };
  const p = { Aa: nsr.Aa, Av: nsr.Av, ...coef, I: o.I || 1 };
  const sp = SISTEMAS_PERIODO[o.sistema] ? o.sistema : sistemaPeriodo(o.sistema);
  const T = o.T > 0 ? o.T : periodoAproximado(o.alturaM || 2.7, sp);
  const Sa = espectro(T, p);                 // g
  const psa = psaEn(T, s);                    // %g
  const r = psa !== null ? (psa / 100) / Sa : null;
  let lectura;
  if (r === null) lectura = 'Sin dato del ShakeMap en este punto.';
  else if (r < 0.5) lectura = 'La sacudida estimada fue menor que la mitad de la de diseño de la NSR-10 para este tipo de edificación. Si hay daño fuerte, sospeche vulnerabilidad previa (construcción informal, deterioro o suelo).';
  else if (r < 1) lectura = 'La sacudida estimada fue cercana a la de diseño. Una edificación que cumpla la NSR-10 puede tener daño reparable.';
  else lectura = 'La sacudida estimada superó el espectro de diseño de la NSR-10. La norma busca evitar el colapso ante el sismo de diseño, no evitar todo daño: es esperable daño incluso en construcciones que cumplen.';
  return { perfil, ...p, T, Sa, psa, r, ...periodos(p), lectura };
}
