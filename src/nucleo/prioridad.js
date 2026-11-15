/* ==========================================================================
   AXIONA EVALÚA · Priorización de la cola de evaluación
   --------------------------------------------------------------------------
   Puntaje transparente de 0 a 100. Cada componente vale entre 0 y 1 y se
   pondera con pesos que la coordinación puede cambiar en Ajustes:

     P = 100 · Σ wᵢ·cᵢ        (Σ wᵢ = 1; se normaliza si no suman 1)

   c_seguridad   1 si el ciudadano o la brigada marcaron una señal grave
                 (colapso, desplome, columnas o vigas dañadas, falla del
                 terreno, gas); si no, n_señales_leves / 3 (tope 1).
   c_dano        máx( categoría BRE 251 de la grieta más ancha / 5 ,
                      deriva medida / deriva límite NSR-10 ) (tope 1).
   c_sacudida    (MMI − 5) / 3 en [0, 1]: MMI 5 → 0, MMI 8 → 1 (ShakeMap).
   c_terreno     máx(prob. licuación, prob. deslizamiento) / 0,10 en [0, 1].
   c_vulnerab    fragilidad del sistema estructural (tabla abajo).
   c_hogar       0,35·[menores] + 0,25·[mayores] + 0,30·[discapacidad]
                 + 0,10·[gestantes] + 0,20·mín(personas/8, 1) (tope 1).
   c_espera      días desde el reporte / 30 (tope 1): nadie se queda atrás.

   Regla de piso: con una señal grave el puntaje pasa a 80 + 0,2·P (80–100):
   todas quedan arriba y siguen ordenadas entre sí por lo demás.
   Bandas: ≥ 70 urgente · 45–70 alta · 25–45 media · < 25 normal.
   ========================================================================== */

export const PESOS_BASE = { seguridad: 0.30, dano: 0.20, sacudida: 0.12, terreno: 0.10, vulnerabilidad: 0.10, hogar: 0.12, espera: 0.06 };
export const NOMBRES_COMPONENTES = {
  seguridad: 'Señales graves', dano: 'Daño medido', sacudida: 'Sacudida en el sitio (MMI)', terreno: 'Licuación o deslizamiento',
  vulnerabilidad: 'Sistema estructural', hogar: 'Hogar vulnerable', espera: 'Tiempo de espera',
};

/** Fragilidad relativa por sistema estructural (0–1): mayor = más vulnerable. Editable en Ajustes. */
export const FRAGILIDAD = { noReforzada: 1.0, bahareque: 0.8, palafito: 0.75, mixto: 0.7, madera: 0.5, confinada: 0.45, porticos: 0.4, '': 0.6 };

export const SENALES_GRAVES = ['colapso', 'inclinacion', 'columnas', 'terreno', 'gas'];
export const SENALES_LEVES = ['grietasGrandes', 'caida', 'pisos', 'puertas', 'ruidos', 'electrico', 'agua'];

const tope = x => Math.max(0, Math.min(1, x));

export function componentes(pr, { hoy = new Date(), fragilidad = FRAGILIDAD } = {}) {
  const s = pr.senales || {};
  const graves = SENALES_GRAVES.filter(k => s[k]).length;
  const leves = SENALES_LEVES.filter(k => s[k]).length;
  const ev = pr.evaluacionResumen; // condiciones de la brigada, si existen
  const graveBrigada = ev && ['colapso', 'inclinacion', 'estructural', 'terreno'].some(k => ['moderado', 'severo'].includes(ev.condiciones?.[k]));
  const c = {};
  c.seguridad = graves || graveBrigada ? 1 : tope(leves / 3);
  const cat = Math.max(0, ...(pr.grietas || []).map(g => g.ultima?.categoria ?? 0));
  const deriva = Math.max(0, ...(pr.inclinaciones || []).map(i => i.razonLimite ?? 0));
  c.dano = tope(Math.max(cat / 5, deriva));
  c.sacudida = pr.sismo?.mmi ? tope((pr.sismo.mmi - 5) / 3) : 0;
  c.terreno = tope(Math.max(pr.sismo?.licuacion || 0, pr.sismo?.deslizamiento || 0) / 0.10);
  c.vulnerabilidad = fragilidad[pr.vivienda?.sistema || ''] ?? 0.6;
  const h = pr.hogar || {};
  c.hogar = tope(0.35 * (+h.menores > 0) + 0.25 * (+h.mayores > 0) + 0.30 * (+h.discapacidad > 0) + 0.10 * (+h.gestantes > 0) + 0.20 * Math.min((+h.personas || 0) / 8, 1));
  const dias = pr.creado ? (hoy - new Date(pr.creado)) / 86400000 : 0;
  c.espera = tope(dias / 30);
  return { c, grave: !!(graves || graveBrigada) };
}

export function puntaje(pr, { pesos = PESOS_BASE, ...op } = {}) {
  const { c, grave } = componentes(pr, op);
  const suma = Object.values(pesos).reduce((a, b) => a + (+b || 0), 0) || 1;
  const aportes = Object.fromEntries(Object.keys(PESOS_BASE).map(k => [k, 100 * ((+pesos[k] || 0) / suma) * c[k]]));
  let P = Object.values(aportes).reduce((a, b) => a + b, 0);
  if (grave) P = 80 + 0.2 * P;
  P = Math.round(P * 10) / 10;
  return { puntaje: P, banda: banda(P), componentes: c, aportes, grave };
}

export function banda(P) {
  if (P >= 70) return { id: 'urgente', n: 'Urgente' };
  if (P >= 45) return { id: 'alta', n: 'Alta' };
  if (P >= 25) return { id: 'media', n: 'Media' };
  return { id: 'normal', n: 'Normal' };
}

/** Ordena la cola: mayor puntaje primero; en empate, el que más lleva esperando. */
export const ordenarCola = (lista, op) => lista
  .map(p => ({ p, r: puntaje(p, op) }))
  .sort((a, b) => b.r.puntaje - a.r.puntaje || new Date(a.p.creado) - new Date(b.p.creado));
