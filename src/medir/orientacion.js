/* ==========================================================================
   AXIONA EVALÚA · Orientación al ciudadano (escala propia, no oficial)
   --------------------------------------------------------------------------
   La Circular 73 de 2026 reserva los carteles verde/amarillo/rojo a los
   evaluadores del RUPE. Por eso aquí NO hay semáforo: hay tres mensajes
   propios que documentan y priorizan:
     alerta     «Señales de alerta: busque evaluación urgente»
     revision   «Daño que requiere revisión de un profesional»
     sin_senales «Sin señales graves en lo que reportó» (no es «segura»)
   Ante la duda, se sube de nivel (el error caro es el falso negativo).

   Grietas: categoría por ancho según BRE Digest 251 (daño en muros):
     0 < 0,1 mm · 1 ≤ 1 · 2 ≤ 5 · 3 ≤ 15 · 4 ≤ 25 · 5 > 25 mm
   y reglas por elemento y patrón (REGLAS_GRIETA, editables por el ingeniero
   coordinador en Ajustes).
   ========================================================================== */

export const CATEGORIAS_BRE = [
  { cat: 0, hasta: 0.1, n: 'Fisura capilar (despreciable)' },
  { cat: 1, hasta: 1, n: 'Muy leve' },
  { cat: 2, hasta: 5, n: 'Leve' },
  { cat: 3, hasta: 15, n: 'Moderada' },
  { cat: 4, hasta: 25, n: 'Severa' },
  { cat: 5, hasta: Infinity, n: 'Muy severa' },
];
export const categoriaBRE = mm => CATEGORIAS_BRE.find(c => mm <= c.hasta) || CATEGORIAS_BRE[5];

export const ELEMENTOS = {
  columna: 'Columna', viga: 'Viga', nudo: 'Unión viga-columna', muroPortante: 'Muro que carga (portante)',
  muroDivisorio: 'Muro divisorio o fachada liviana', placa: 'Piso o placa', otro: 'Otro',
};
export const PATRONES = { diagonal: 'Diagonal o en X', horizontal: 'Horizontal', vertical: 'Vertical', ramificada: 'Ramificada / mapa' };

/** Umbrales en mm (v1, revisables). [revision, alerta] */
export const REGLAS_GRIETA = {
  columna: { diagonal: [0, 0.3], otro: [0, 1] },
  viga: { diagonal: [0, 0.3], otro: [0, 1] },
  nudo: { diagonal: [0, 0.3], otro: [0, 0.5] },
  muroPortante: { diagonal: [1, 3], horizontal: [1, 5], otro: [2, 5] },
  muroDivisorio: { otro: [5, 15] },
  placa: { otro: [3, 10] },
  otro: { otro: [3, 10] },
  crecimientoMm: 0.5, crecimientoRel: 0.25,
};

export function patronPorAngulo(ang) {
  if (ang === null || ang === undefined) return 'otro';
  if (ang >= 25 && ang <= 65) return 'diagonal';
  if (ang < 25) return 'horizontal';
  return 'vertical';
}

/**
 * Lectura de una grieta medida.
 * @param {object} g { elemento, patron, anchoMm, previaMm }
 */
export function leerGrieta(g, reglas = REGLAS_GRIETA) {
  const el = reglas[g.elemento] || reglas.otro;
  const pat = g.patron || 'otro';
  const [rev, ale] = el[pat] || el.otro || [3, 10];
  const cat = categoriaBRE(g.anchoMm);
  const razones = [];
  let nivel = 'sin_senales';
  if (g.anchoMm >= ale) { nivel = 'alerta'; razones.push(`Grieta de ${fmt(g.anchoMm)} mm en ${ELEMENTOS[g.elemento]?.toLowerCase() || 'el elemento'} (umbral de alerta: ${fmt(ale)} mm).`); }
  else if (g.anchoMm >= rev && (rev > 0 || g.anchoMm > 0)) { nivel = 'revision'; razones.push(`Grieta de ${fmt(g.anchoMm)} mm en ${ELEMENTOS[g.elemento]?.toLowerCase() || 'el elemento'}.`); }
  if (['columna', 'viga', 'nudo'].includes(g.elemento) && pat === 'diagonal' && nivel !== 'alerta' && g.anchoMm > 0.1) { nivel = 'alerta'; razones.push('Grieta diagonal en un elemento que sostiene la casa: puede ser falla por cortante.'); }
  if (g.previaMm > 0) {
    const d = g.anchoMm - g.previaMm;
    if (d >= reglas.crecimientoMm || d / g.previaMm >= reglas.crecimientoRel) { nivel = 'alerta'; razones.push(`La grieta creció ${fmt(d)} mm desde la medición anterior: está activa.`); }
  }
  return { nivel, categoria: cat.cat, categoriaTxt: cat.n, razones };
}

const fmt = v => String(Math.round(v * 100) / 100).replace('.', ',');

export const SENALES = [
  { id: 'colapso', t: 'Se cayó una parte de la casa o un piso', grave: true },
  { id: 'inclinacion', t: 'La casa o un muro se ve inclinado', grave: true },
  { id: 'columnas', t: 'Columnas o vigas partidas, con hierro a la vista o concreto caído', grave: true },
  { id: 'terreno', t: 'El piso o el terreno se hundió, se agrietó o hay deslizamiento', grave: true },
  { id: 'gas', t: 'Huele a gas', grave: true },
  { id: 'grietasGrandes', t: 'Grietas por donde cabe un dedo o en forma de X', grave: false },
  { id: 'caida', t: 'Tejas, fachada, balcones o tanques sueltos que pueden caer', grave: false },
  { id: 'pisos', t: 'Pisos o placas con grietas o desniveles nuevos', grave: false },
  { id: 'puertas', t: 'Puertas o ventanas que ya no cierran', grave: false },
  { id: 'ruidos', t: 'Crujidos o pedazos que siguen cayendo', grave: false },
  { id: 'electrico', t: 'Cables sueltos o chispas', grave: false },
  { id: 'agua', t: 'Fugas de agua o humedad nueva', grave: false },
];

export const NIVELES = {
  alerta: { t: 'Señales de alerta', d: 'Busque evaluación urgente. Mientras tanto, no permanezca dentro ni cerca de lo que puede caer.', clase: 'alerta' },
  revision: { t: 'Daño que requiere revisión', d: 'Un profesional debe revisarla. Evite las zonas dañadas y no haga reparaciones que tapen las grietas.', clase: 'revision' },
  sin_senales: { t: 'Sin señales graves en lo que reportó', d: 'Esto no quiere decir que la casa sea segura: solo un profesional del RUPE puede evaluarla. Si algo cambia, vuelva a medir.', clase: 'calma' },
};

/** Orientación del predio con todo lo que hay: señales, grietas e inclinaciones. */
export function orientar(pr, reglas = REGLAS_GRIETA) {
  const razones = [], acciones = [];
  let nivel = 'sin_senales';
  const subir = n => { if (n === 'alerta' || (n === 'revision' && nivel === 'sin_senales')) nivel = n; };
  const s = pr.senales || {};
  for (const x of SENALES) if (s[x.id]) { subir(x.grave ? 'alerta' : 'revision'); razones.push(x.t + '.'); }
  if (s.gas) acciones.push('Cierre el registro del gas, no prenda luces ni fósforos y salga. Llame al 123.');
  if (s.electrico) acciones.push('Baje los tacos de la energía si puede hacerlo sin riesgo.');
  if (s.colapso || s.inclinacion || s.columnas) acciones.push('Salga de la casa y aleje a su familia de muros y fachadas.');
  for (const g of pr.grietas || []) if (g.ultima) { const l = leerGrieta({ elemento: g.elemento, patron: g.patron, anchoMm: g.ultima.anchoMm, previaMm: g.previa?.anchoMm }, reglas); subir(l.nivel); razones.push(...l.razones); }
  for (const i of pr.inclinaciones || []) if (i.lectura) { subir(i.lectura.nivel === 'tolerancia' ? 'sin_senales' : i.lectura.nivel); if (i.lectura.nivel !== 'tolerancia') razones.push(`Desplome de ${fmt(i.deriva)} % en ${i.elemento || 'el elemento'} (${fmt(i.desplomeMm)} mm en ${fmt(i.alturaM)} m).`); }
  if (pr.sismo?.licuacion >= 0.1 || pr.sismo?.deslizamiento >= 0.1) { subir('revision'); razones.push('El modelo de la USGS marca alta susceptibilidad del terreno (licuación o deslizamiento) en esta zona.'); }
  return { nivel, ...NIVELES[nivel], razones, acciones };
}
