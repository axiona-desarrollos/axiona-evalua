/* ==========================================================================
   AXIONA EVALÚA · Espectro de diseño de la NSR-10 (Título A)
   --------------------------------------------------------------------------
   Ecuaciones (NSR-10, A.2.6, amortiguamiento 5 %):
     T0 = 0,10·Av·Fv / (Aa·Fa)                         (A.2.6-6)
     TC = 0,48·Av·Fv / (Aa·Fa)                         (A.2.6-2)
     TL = 2,4·Fv                                       (A.2.6-4)
     Sa = 2,5·Aa·Fa·I                 si T ≤ TC         (A.2.6-3)
     Sa = 1,2·Av·Fv·I / T             si TC < T ≤ TL    (A.2.6-1)
     Sa = 1,2·Av·Fv·TL·I / T²         si T > TL         (A.2.6-5)
   (para análisis modal, en T < T0: Sa = 2,5·Aa·Fa·I·(0,4 + 0,6·T/T0))
   Coeficientes de sitio Fa y Fv: tablas A.2.4-3 y A.2.4-4, interpolando en
   línea recta entre columnas. Perfil de suelo por Vs30: tabla A.2.4-1.
   Período aproximado: Ta = Ct·h^α (A.4.2-3, tabla A.4.2-1).

   Valores por municipio (Apéndice A-4): ver nucleo/ciudades.js. Este módulo
   no decide nada por sí solo: el ingeniero puede cambiar el perfil de suelo,
   el coeficiente de importancia y la altura.
   ========================================================================== */

const COLS = [0.1, 0.2, 0.3, 0.4, 0.5];
const FA = { A: [0.8, 0.8, 0.8, 0.8, 0.8], B: [1.0, 1.0, 1.0, 1.0, 1.0], C: [1.2, 1.2, 1.1, 1.0, 1.0], D: [1.6, 1.4, 1.2, 1.1, 1.0], E: [2.5, 1.7, 1.2, 0.9, 0.9] };
const FV = { A: [0.8, 0.8, 0.8, 0.8, 0.8], B: [1.0, 1.0, 1.0, 1.0, 1.0], C: [1.7, 1.6, 1.5, 1.4, 1.3], D: [2.4, 2.0, 1.8, 1.6, 1.5], E: [3.5, 3.2, 2.8, 2.4, 2.4] };

function interpolarTabla(fila, a) {
  if (a <= COLS[0]) return fila[0];
  if (a >= COLS[4]) return fila[4];
  const i = COLS.findIndex((c, k) => a >= c && a <= COLS[k + 1]);
  const t = (a - COLS[i]) / (COLS[i + 1] - COLS[i]);
  return fila[i] + t * (fila[i + 1] - fila[i]);
}

export const PERFILES = {
  A: 'A · Roca competente (Vs30 > 1.500 m/s)',
  B: 'B · Roca de rigidez media (760–1.500 m/s)',
  C: 'C · Suelos muy densos o roca blanda (360–760 m/s)',
  D: 'D · Suelos rígidos (180–360 m/s)',
  E: 'E · Suelos blandos (Vs30 < 180 m/s)',
  F: 'F · Requiere estudio de respuesta del sitio',
};

/** Fa y Fv (tablas A.2.4-3 y A.2.4-4). El perfil F no tiene valor: exige estudio de sitio. */
export function coeficientesSitio(perfil, Aa, Av) {
  if (!FA[perfil]) return null;
  return { Fa: +interpolarTabla(FA[perfil], Aa).toFixed(3), Fv: +interpolarTabla(FV[perfil], Av).toFixed(3) };
}

/** Perfil de suelo sugerido por Vs30 (tabla A.2.4-1, solo el criterio de velocidad). */
export function perfilPorVs30(vs30) {
  if (!(vs30 > 0)) return null;
  if (vs30 > 1500) return 'A';
  if (vs30 > 760) return 'B';
  if (vs30 > 360) return 'C';
  if (vs30 >= 180) return 'D';
  return 'E';
}

/** Períodos de control del espectro. */
export function periodos({ Aa, Av, Fa, Fv }) {
  return { T0: 0.1 * Av * Fv / (Aa * Fa), TC: 0.48 * Av * Fv / (Aa * Fa), TL: 2.4 * Fv };
}

/**
 * Aceleración espectral de diseño Sa (en g) para el período T (s).
 * @param {boolean} modal  usa la rama ascendente para T < T0
 */
export function espectro(T, p, { modal = false } = {}) {
  const { Aa, Av, Fa, Fv, I = 1 } = p;
  const { T0, TC, TL } = periodos(p);
  if (modal && T < T0) return 2.5 * Aa * Fa * I * (0.4 + 0.6 * T / T0);
  if (T <= TC) return 2.5 * Aa * Fa * I;
  if (T <= TL) return 1.2 * Av * Fv * I / T;
  return 1.2 * Av * Fv * TL * I / (T * T);
}

/** Tabla A.4.2-1 (Ct, α). */
export const SISTEMAS_PERIODO = {
  porticosConcreto: { n: 'Pórticos de concreto reforzado', Ct: 0.047, a: 0.9 },
  porticosAcero: { n: 'Pórticos de acero', Ct: 0.072, a: 0.8 },
  aceroArriostrado: { n: 'Pórticos de acero arriostrados excéntricamente', Ct: 0.073, a: 0.75 },
  otros: { n: 'Mampostería, muros y demás sistemas', Ct: 0.049, a: 0.75 },
};

/** Período fundamental aproximado Ta = Ct·h^α (h en metros, altura sobre la base). */
export function periodoAproximado(h, sistema = 'otros') {
  const s = SISTEMAS_PERIODO[sistema] || SISTEMAS_PERIODO.otros;
  return s.Ct * Math.pow(Math.max(0, h), s.a);
}

/** Sistema de período según el sistema estructural del formulario de evaluación. */
export function sistemaPeriodo(sistemaEvaluacion) {
  return sistemaEvaluacion === 'porticos' ? 'porticosConcreto' : 'otros';
}
