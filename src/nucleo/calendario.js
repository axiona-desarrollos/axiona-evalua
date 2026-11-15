/* ==========================================================================
   AXIONA EVALÚA · Calendario de Colombia: festivos y días hábiles
   --------------------------------------------------------------------------
   Festivos según la Ley 51 de 1983 («Ley Emiliani») y la Ley 35 de 1939:
   - fijos: 1 ene, 1 may, 20 jul, 7 ago, 8 dic, 25 dic;
   - trasladables al lunes siguiente: 6 ene, 19 mar, 29 jun, 15 ago, 12 oct,
     1 nov, 11 nov;
   - por Pascua: Jueves y Viernes Santo (fijos); Ascensión (+43 días),
     Corpus Christi (+64) y Sagrado Corazón (+71), ya trasladados a lunes.
   Domingo de Pascua por el algoritmo de Meeus/Jones/Butcher (gregoriano).
   Todas las fechas se manejan como días civiles (UTC a medianoche) para que
   la zona horaria del teléfono no corra un día los plazos.
   ========================================================================== */

const DIA = 86400000;
export const fecha = (a, m, d) => new Date(Date.UTC(a, m - 1, d));
export const aISO = f => f.toISOString().slice(0, 10);
export const deISO = s => { const [a, m, d] = String(s).slice(0, 10).split('-').map(Number); return fecha(a, m, d); };
export const sumarDias = (f, n) => new Date(f.getTime() + n * DIA);
export const diasEntre = (a, b) => Math.round((b.getTime() - a.getTime()) / DIA);

/** Domingo de Pascua (Meeus/Jones/Butcher). */
export function pascua(anio) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fecha(anio, mes, dia);
}

/** Lunes siguiente (o el mismo día si ya es lunes). */
const alLunes = f => sumarDias(f, (8 - f.getUTCDay()) % 7);

const cache = new Map();
/** Festivos del año: Map<'aaaa-mm-dd', nombre>. */
export function festivos(anio) {
  if (cache.has(anio)) return cache.get(anio);
  const F = new Map();
  const pon = (f, n) => F.set(aISO(f), n);
  pon(fecha(anio, 1, 1), 'Año Nuevo');
  pon(fecha(anio, 5, 1), 'Día del Trabajo');
  pon(fecha(anio, 7, 20), 'Día de la Independencia');
  pon(fecha(anio, 8, 7), 'Batalla de Boyacá');
  pon(fecha(anio, 12, 8), 'Inmaculada Concepción');
  pon(fecha(anio, 12, 25), 'Navidad');
  pon(alLunes(fecha(anio, 1, 6)), 'Reyes Magos');
  pon(alLunes(fecha(anio, 3, 19)), 'San José');
  pon(alLunes(fecha(anio, 6, 29)), 'San Pedro y San Pablo');
  pon(alLunes(fecha(anio, 8, 15)), 'Asunción de la Virgen');
  pon(alLunes(fecha(anio, 10, 12)), 'Día de la Raza');
  pon(alLunes(fecha(anio, 11, 1)), 'Todos los Santos');
  pon(alLunes(fecha(anio, 11, 11)), 'Independencia de Cartagena');
  const P = pascua(anio);
  pon(sumarDias(P, -3), 'Jueves Santo');
  pon(sumarDias(P, -2), 'Viernes Santo');
  pon(sumarDias(P, 43), 'Ascensión del Señor');
  pon(sumarDias(P, 64), 'Corpus Christi');
  pon(sumarDias(P, 71), 'Sagrado Corazón');
  cache.set(anio, F);
  return F;
}

export const esFestivo = f => festivos(f.getUTCFullYear()).has(aISO(f));
export const esHabil = f => { const d = f.getUTCDay(); return d !== 0 && d !== 6 && !esFestivo(f); };

/**
 * Suma n días hábiles: el término empieza a contar el día hábil siguiente a
 * la fecha de inicio (p. ej. la radicación de un derecho de petición).
 */
export function sumarHabiles(inicio, n) {
  let f = inicio, k = 0;
  while (k < n) { f = sumarDias(f, 1); if (esHabil(f)) k++; }
  return f;
}

/** Días hábiles entre dos fechas (sin contar el día de inicio, contando el final si es hábil). */
export function habilesEntre(a, b) {
  let n = 0, f = a;
  const signo = b >= a ? 1 : -1;
  while (signo > 0 ? f < b : f > b) { f = sumarDias(f, signo); if (esHabil(f)) n += signo; }
  return n;
}

/**
 * Suma meses calendario (art. 59 del Código de Régimen Político y Municipal:
 * los plazos de meses terminan el mismo día del mes final; si ese día no
 * existe, el último día del mes).
 */
export function sumarMeses(f, n) {
  const a = f.getUTCFullYear(), m = f.getUTCMonth() + n, d = f.getUTCDate();
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m, Math.min(d, ultimo)));
}

/** Si la fecha cae en día no hábil, se corre al siguiente hábil (vencimiento de términos). */
export const siguienteHabil = f => { let x = f; while (!esHabil(x)) x = sumarDias(x, 1); return x; };

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** «lunes 18 de marzo de 2027» */
export const textoFecha = (f, conDia = true) => `${conDia ? DIAS[f.getUTCDay()] + ' ' : ''}${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;
/** Hoy como día civil en Colombia (UTC−5). */
export const hoyColombia = (ahora = new Date()) => { const t = new Date(ahora.getTime() - 5 * 3600000); return fecha(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
