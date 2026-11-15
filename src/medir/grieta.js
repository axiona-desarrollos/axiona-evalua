/* ==========================================================================
   AXIONA EVALÚA · Medición del ancho de una grieta
   --------------------------------------------------------------------------
   Entra una imagen en gris YA RECTIFICADA al plano del muro (la tarjeta-regla
   da la escala: «escala» píxeles por milímetro) y, opcionalmente, el punto
   que tocó el usuario sobre la grieta. Pasos:

   1. Fondo: cierre morfológico con ventana k > ancho máximo esperado. La
      grieta es un valle oscuro angosto; el cierre la «tapa» y deja el muro.
   2. Contraste d = cierre − gris (sombrero negro). Ruido por mediana y MAD:
      σ ≈ 1,4826·MAD. Umbral con histéresis: alto = med + máx(5σ, 10),
      bajo = med + máx(2,5σ, 5) niveles de gris.
   3. Componente conexa más cercana al toque (o la más larga si no hay toque);
      se descartan manchas: hace falta un esqueleto ≥ 3 mm.
   4. Esqueleto (Zhang–Suen) y dirección local por componentes principales
      de los puntos del esqueleto cercanos.
   5. Ancho en cada punto del esqueleto con el perfil de gris a lo largo de
      la normal (paso 0,25 px, bilineal):
        ancho equivalente por área: w = ∫(b − I(x))dx / C, con b = fondo
        (mediana de las colas del perfil) y C = profundidad del valle. El
        área bajo el fondo se conserva con el desenfoque del lente, por eso
        mide bien aunque los bordes se vean borrosos.
        · resuelta (w ≥ 4 px): C es la profundidad propia del perfil;
        · no resuelta: C = profundidad mediana de las partes resueltas de la
          misma grieta; si ninguna parte está resuelta, el resultado es una
          COTA SUPERIOR (lado seguro) y se informa como «≤».
   6. Resumen en mm: ancho representativo = percentil 95 (no se deja engañar
      por un punto suelto), máximo puntual, mediana, largo del esqueleto,
      ángulo respecto a la horizontal de la tarjeta e incertidumbre:
        u = 0,8 px / escala + ancho · (3 % + error de escala de la tarjeta).
   Es una medición de apoyo: el profesional la valida y puede corregirla.
   ========================================================================== */
import { muestra, suavizar, cierre, mediaCaja, medianaMAD, percentil, componentesConexas, esqueleto, distanciaAlFondo } from './imagen.js';

/**
 * @param {Float32Array|Uint8Array} G  gris rectificado
 * @param {number} w, h
 * @param {object} o  { escala (px/mm), semilla [x,y] px, maxAnchoMm, sensibilidad (0,5–2), errorEscala (relativo) }
 */
export function medirGrieta(G, w, h, o = {}) {
  const escala = o.escala || 10, sens = o.sensibilidad || 1, maxAnchoMm = o.maxAnchoMm || 12;
  const g = suavizar(Float32Array.from(G), w, h);
  let k = Math.round(maxAnchoMm * escala * 1.2) | 1;
  k = Math.max(9, Math.min(k, (Math.min(w, h) >> 1) | 1));
  const fondo = cierre(g, w, h, k);
  const d0 = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d0[i] = fondo[i] - g[i];
  // el cierre sobre un muro con luz desigual deja un desfase que varía despacio: se resta su media local
  const lento = mediaCaja(d0, w, h, k);
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = Math.max(0, d0[i] - lento[i]);

  // ruido sobre una muestra del contraste
  const paso = Math.max(1, Math.floor((w * h) / 40000)), mues = [];
  for (let i = 0; i < w * h; i += paso) mues.push(d[i]);
  const { med, mad } = medianaMAD(mues);
  const sigma = 1.4826 * mad;
  const tAlto = med + Math.max(5 * sigma, 10) / sens, tBajo = med + Math.max(2.5 * sigma, 5) / sens;

  // histéresis: débiles conectados a fuertes
  const debil = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) debil[i] = d[i] > tBajo ? 1 : 0;
  const { comps } = componentesConexas(debil, w, h);
  const minLargoPx = 3 * escala;
  const candidatas = [];
  for (const c of comps) {
    let fuerte = false;
    for (const i of c.px) if (d[i] > tAlto) { fuerte = true; break; }
    if (!fuerte || c.px.length < minLargoPx) continue;
    candidatas.push(c);
  }
  if (!candidatas.length) return { ok: false, motivo: 'No se encontró una grieta en la zona. Acérquese, mejore la luz o suba la sensibilidad.' };

  // elegir: la más cercana al toque, o la más grande
  let elegida = null;
  if (o.semilla) {
    const [sx, sy] = o.semilla, rMax = 4 * escala;
    let dm = Infinity;
    for (const c of candidatas) for (const i of c.px) {
      const x = i % w, y = (i - x) / w, dd = Math.hypot(x - sx, y - sy);
      if (dd < dm) { dm = dd; elegida = c; }
    }
    if (dm > rMax) elegida = null;
  }
  if (!elegida) elegida = candidatas.reduce((a, b) => (b.px.length > a.px.length ? b : a));
  if (o.semilla && !candidatas.includes(elegida)) return { ok: false, motivo: 'No hay grieta donde tocó.' };

  // máscara de la componente, en su recuadro (con margen)
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (const i of elegida.px) { const x = i % w, y = (i - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const mg = 2; x0 = Math.max(0, x0 - mg); y0 = Math.max(0, y0 - mg); x1 = Math.min(w - 1, x1 + mg); y1 = Math.min(h - 1, y1 + mg);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, mask = new Uint8Array(bw * bh);
  for (const i of elegida.px) { const x = i % w, y = (i - x) / w; mask[(y - y0) * bw + (x - x0)] = 1; }
  const sk = esqueleto(mask, bw, bh);
  const dt = distanciaAlFondo(mask, bw, bh);
  // el trazo principal es el camino más largo del esqueleto: así las ramitas que deja el borde ruidoso no suman
  const camino = caminoMasLargo(sk, bw, bh);
  const puntos = camino.map(i => { const x = i % bw, y = (i - x) / bw; return [x + x0, y + y0, dt[i]]; });
  if (puntos.length < minLargoPx * 0.6) return { ok: false, motivo: 'La marca encontrada es muy corta para ser una grieta (menos de 3 mm). Puede ser una mancha.' };
  // largo sobre el trazo submuestreado (cada ~5 px): la escalera de píxeles no infla la medida
  let largoPx = 0;
  const pasoL = 5;
  for (let n = pasoL; n < puntos.length + pasoL - 1; n += pasoL) {
    const a = puntos[n - pasoL], b = puntos[Math.min(n, puntos.length - 1)];
    largoPx += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  // orientación global (componentes principales del esqueleto)
  const ang = direccion(puntos.map(p => [p[0], p[1]]));
  const anguloHorizontal = Math.abs(((Math.atan2(ang[1], ang[0]) * 180 / Math.PI) + 180) % 180);
  const anguloH = anguloHorizontal > 90 ? 180 - anguloHorizontal : anguloHorizontal;

  // perfiles transversales
  const cada = Math.max(1, Math.round(escala * 0.25)); // un perfil cada ~0,25 mm
  const muestras = [];
  const vecinos = puntos.map(p => [p[0], p[1]]);
  for (let n = 0; n < puntos.length; n += cada) {
    const [px, py, dist] = puntos[n];
    const rr = Math.max(3, 1.5 * dist + 2);
    const cerca = vecinos.filter(q => Math.abs(q[0] - px) <= rr && Math.abs(q[1] - py) <= rr);
    if (cerca.length < 3) continue;
    const t = direccion(cerca), nx = -t[1], ny = t[0];
    // perfil sobre la imagen ORIGINAL (sin suavizar): el área bajo el fondo se conserva con el desenfoque
    const L = Math.max(8, 3 * dist + 8), perfil = [];
    for (let s = -L; s <= L + 1e-9; s += 0.25) perfil.push(muestra(G, w, h, px + nx * s, py + ny * s));
    if (perfil.some(Number.isNaN)) continue;
    const c0 = Math.round(L / 0.25), nucleo = Math.round((dist + 4) / 0.25);
    // fondo: mediana de las colas del perfil (lejos de la grieta)
    const colas = perfil.filter((_, j) => Math.abs(j - c0) > nucleo);
    const b = percentil(colas, 0.5);
    // mínimo con media móvil de 3 muestras (0,75 px) para no perseguir el ruido
    let im = c0, vm = Infinity;
    const rc = Math.round((dist + 1.5) / 0.25);
    for (let j = c0 - rc; j <= c0 + rc; j++) { const v = (perfil[j - 1] + perfil[j] + perfil[j + 1]) / 3; if (v < vm) { vm = v; im = j; } }
    const prof = b - vm;
    if (prof < tBajo) continue;
    let area = 0;
    for (let j = c0 - nucleo; j <= c0 + nucleo; j++) area += (b - perfil[j]) * 0.25;
    if (!(area > 0)) continue;
    muestras.push({ x: px, y: py, eq: area / prof, area, prof });
  }
  if (muestras.length < 3) return { ok: false, motivo: 'No se pudo medir el ancho: la grieta está muy borrosa o con mala luz.' };

  // las partes anchas (≥ 3 px) muestran el contraste real del interior de la grieta; con él se corrigen las angostas
  const RES = 4; // px: por debajo, el desenfoque del lente domina el perfil
  const resueltas = muestras.filter(m => m.eq >= RES);
  const C = resueltas.length >= 3 ? percentil(resueltas.map(m => m.prof), 0.5) : null;
  for (const m of muestras) m.anchoPx = m.eq >= RES || !C ? m.eq : Math.min(m.eq, m.area / C);
  const anchos = muestras.map(m => m.anchoPx / escala);
  // sin partes resueltas, el ancho por área sobre la profundidad aparente es una COTA SUPERIOR (lado seguro)
  const noResuelta = !C && percentil(muestras.map(m => m.eq), 0.5) < RES;
  const p95 = percentil(anchos, 0.95), medAncho = percentil(anchos, 0.5), maxPunt = Math.max(...anchos);
  const u = 0.8 / escala + p95 * (0.03 + (o.errorEscala || 0));
  return {
    ok: true,
    anchoMm: redondear(p95), anchoMedianoMm: redondear(medAncho), anchoMaxPuntualMm: redondear(maxPunt),
    incertidumbreMm: redondear(u), rango: noResuelta ? [0, redondear(p95 + u)] : [redondear(Math.max(0, p95 - u)), redondear(p95 + u)],
    largoMm: Math.round(largoPx / escala * 10) / 10, anguloHorizontal: Math.round(anguloH),
    resolucionMinMm: redondear(1.5 / escala), noResuelta,
    muestras: muestras.map(m => ({ x: m.x, y: m.y, mm: redondear(m.anchoPx / escala) })),
    trazo: puntos.filter((_, n) => n % 4 === 0 || n === puntos.length - 1).map(p => [p[0], p[1]]),
    umbral: { alto: tAlto, bajo: tBajo, ruido: sigma },
  };
}

const redondear = v => (v >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);

/**
 * Camino más largo del esqueleto (diámetro geodésico): dos búsquedas en
 * anchura desde un extremo cualquiera. Devuelve los índices en orden.
 */
export function caminoMasLargo(sk, w, h) {
  const nodos = [];
  for (let i = 0; i < w * h; i++) if (sk[i]) nodos.push(i);
  if (!nodos.length) return [];
  const bfs = inicio => {
    const dist = new Int32Array(w * h).fill(-1), prev = new Int32Array(w * h).fill(-1), cola = [inicio];
    dist[inicio] = 0;
    let ultimo = inicio;
    for (let q = 0; q < cola.length; q++) {
      const i = cola[q], x = i % w, y = (i - x) / w;
      ultimo = i;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (sk[j] && dist[j] < 0) { dist[j] = dist[i] + 1; prev[j] = i; cola.push(j); }
      }
    }
    return { ultimo, prev };
  };
  // la componente más grande del esqueleto manda (puede haber trozos sueltos)
  const a = bfs(nodos[0]).ultimo, { ultimo: b, prev } = bfs(a);
  const camino = [];
  for (let i = b; i >= 0; i = prev[i]) camino.push(i);
  return camino;
}

/** Dirección principal (vector unitario) de una nube de puntos. */
export function direccion(pts) {
  let mx = 0, my = 0;
  for (const [x, y] of pts) { mx += x; my += y; }
  mx /= pts.length; my /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { const dx = x - mx, dy = y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return [Math.cos(th), Math.sin(th)];
}
