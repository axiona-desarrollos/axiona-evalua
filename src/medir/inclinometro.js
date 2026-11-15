/* ==========================================================================
   AXIONA EVALÚA · Inclinómetro (desplome de muros y columnas)
   --------------------------------------------------------------------------
   El acelerómetro del teléfono en reposo mide la gravedad en sus ejes
   (x a la derecha de la pantalla, y hacia arriba, z saliendo de la pantalla).
   Cada lectura promedia ~2 s de muestras y exige quietud.

   Método de INVERSIÓN (cancela el sesgo del sensor, como en un nivel de
   burbuja que se gira 180°):
   - Fuera del plano (muro): lectura 1 con la ESPALDA del teléfono contra el
     muro; lectura 2 con la PANTALLA contra el muro (girado sobre el eje
     vertical). Con sesgo b: z₁ = −g·sen θ + b, z₂ = +g·sen θ + b ⇒
        sen θ = (z₂ − z₁) / (|a₁| + |a₂|)
   - En el plano (columna o borde): lectura 1 de pie; lectura 2 de cabeza
     (girado 180° en su plano): x₁ = g·sen φ + b, x₂ = −g·sen φ + b ⇒
        sen φ = (x₁ − x₂) / (|a₁| + |a₂|)
   Usar |a| medido en lugar de 9,81 corrige errores de ganancia del sensor.

   Resultados: θ, deriva = tan θ (en %), desplome δ = H·tan θ en la altura H.
   Incertidumbre: σθ ≈ √(σ₁²/n₁ + σ₂²/n₂) / (2g) más un piso de 0,05°.

   Lectura de la deriva residual (FEMA P-58, estados de daño por deriva
   residual): 0,2 % realineamiento menor · 0,5 % realineamiento mayor ·
   1 % reparación posiblemente no viable · 2 % riesgo de colapso.
   Una inclinación pequeña puede ser de la construcción original: compárela
   con la de elementos vecinos sin daño.
   ========================================================================== */

export const LIMITES_DERIVA = [
  { hasta: 0.2, nivel: 'tolerancia', n: 'Dentro de tolerancias de construcción', clase: 'ok' },
  { hasta: 0.5, nivel: 'revision', n: 'Desplome leve: requiere revisión', clase: 'media' },
  { hasta: 1.0, nivel: 'alerta', n: 'Desplome importante: realineamiento mayor', clase: 'alta' },
  { hasta: 2.0, nivel: 'alerta', n: 'Desplome severo: la reparación puede no ser viable', clase: 'alta' },
  { hasta: Infinity, nivel: 'alerta', n: 'Desplome muy severo: riesgo de colapso. No permanezca cerca.', clase: 'alta' },
];
export const DERIVA_REFERENCIA = 0.5; // % (FEMA P-58, DS2): para la priorización

const media = a => a.reduce((s, v) => s + v, 0) / a.length;
const desv = a => { const m = media(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };

/** Resume una lectura: promedio por eje, |a| y dispersión. */
export function resumirLectura(muestras) {
  const xs = muestras.map(m => m[0]), ys = muestras.map(m => m[1]), zs = muestras.map(m => m[2]);
  const m = [media(xs), media(ys), media(zs)];
  return { x: m[0], y: m[1], z: m[2], norma: Math.hypot(...m), n: muestras.length, sx: desv(xs), sy: desv(ys), sz: desv(zs) };
}

/** ¿El teléfono estuvo quieto? (desviación por eje < 0,05 m/s²) */
export const quieto = l => l.n >= 20 && Math.max(l.sx, l.sy, l.sz) < 0.05;

/**
 * Inclinación por inversión.
 * @param {'muro'|'columna'} modo
 * @param {object} l1, l2  lecturas resumidas
 * @param {number} alturaM altura del elemento (m) para el desplome
 */
export function inclinacion(modo, l1, l2, alturaM = 2.5, { ios = false } = {}) {
  const suma = l1.norma + l2.norma;
  let s, s1, s2;
  if (modo === 'muro') { s = (l2.z - l1.z) / suma; s1 = l1.sz; s2 = l2.sz; } else { s = (l1.x - l2.x) / suma; s1 = l1.sx; s2 = l2.sx; }
  if (ios) s = -s; // iOS entrega la aceleración con el signo contrario
  const th = Math.asin(Math.max(-1, Math.min(1, s)));
  const sigma = Math.sqrt(s1 * s1 / Math.max(1, l1.n) + s2 * s2 / Math.max(1, l2.n)) / (suma / 2) / 2;
  const incGrados = Math.max(0.05, sigma * 180 / Math.PI);
  const deriva = Math.abs(Math.tan(th)) * 100;
  const sesgo = modo === 'muro' ? (l1.z + l2.z) / 2 : (l1.x + l2.x) / 2;
  return {
    modo, grados: Math.abs(th) * 180 / Math.PI, signo: Math.sign(th), deriva, desplomeMm: Math.abs(Math.tan(th)) * alturaM * 1000, alturaM,
    incertidumbreGrados: incGrados, incertidumbreDeriva: Math.tan(incGrados * Math.PI / 180) * 100,
    sesgoSensor: sesgo, lectura: lecturaDeriva(deriva), razonLimite: deriva / DERIVA_REFERENCIA,
    hacia: modo === 'muro' ? (th > 0 ? 'hacia donde miraba la pantalla en la lectura 1' : 'hacia el muro (lado de la espalda en la lectura 1)') : (th > 0 ? 'hacia la derecha de la pantalla en la lectura 1' : 'hacia la izquierda de la pantalla en la lectura 1'),
  };
}

/** Inclinación de una sola lectura (sin inversión): útil para una vista rápida en vivo. */
export function inclinacionRapida(modo, l) {
  const s = modo === 'muro' ? -l.z / l.norma : l.x / l.norma;
  return Math.abs(Math.asin(Math.max(-1, Math.min(1, s)))) * 180 / Math.PI;
}

export const lecturaDeriva = d => LIMITES_DERIVA.find(l => d < l.hasta);

/** Captura muestras del acelerómetro durante ms milisegundos. */
export async function capturar(ms = 2000) {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    const p = await DeviceMotionEvent.requestPermission();
    if (p !== 'granted') throw new Error('Sin permiso para usar el sensor de movimiento.');
  }
  return new Promise((ok, mal) => {
    const m = [];
    const fn = e => { const a = e.accelerationIncludingGravity; if (a && a.x !== null) m.push([a.x, a.y, a.z]); };
    addEventListener('devicemotion', fn);
    setTimeout(() => {
      removeEventListener('devicemotion', fn);
      if (m.length < 10) mal(new Error('Este equipo no entrega datos del acelerómetro. Use un celular.'));
      else ok(resumirLectura(m.slice(Math.floor(m.length * 0.15)))); // se descarta el arranque (el pulso del toque)
    }, ms);
  });
}
