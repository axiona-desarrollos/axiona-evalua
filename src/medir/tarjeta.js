/* ==========================================================================
   AXIONA EVALÚA · Tarjeta-regla de grietas
   --------------------------------------------------------------------------
   Una tarjeta del tamaño de una cédula (85,6 × 54 mm) con dos marcadores de
   6 × 6 celdas del motor de visión de Axiona Obra (ids 14 y 15), una regla
   de 50 mm y un comparador de anchos (0,1 a 3 mm). Se pega al muro junto a
   la grieta y se toma la foto de frente.

   Geometría: los 8 vértices de los dos marcadores (en mm sobre la tarjeta)
   y sus 8 puntos detectados en la foto dan la homografía tarjeta → foto por
   mínimos cuadrados con normalización de Hartley. Con ella:
   - se rectifica la zona tocada al plano del muro con escala conocida
     (píxeles por mm), y se mide la grieta (medir/grieta.js);
   - el error de reproyección dice qué tan buena es la foto;
   - la relación entre los lados de los marcadores dice si la foto está de
     frente (perspectiva ≤ 15 %).
   Si la impresora escaló la tarjeta, el usuario mide la regla de 50 mm y la
   app corrige todas las medidas con factor = medido / 50.
   ========================================================================== */
import { detectar, gris, refinarEsquinas } from '@obra-vision/detector.js';
import { celdas } from '@obra-vision/marcadores.js';
import { resolver } from '@obra-vision/pose.js';
import { muestra } from './imagen.js';

export const TARJETA = { ancho: 85.6, alto: 54, lado: 14, ids: [14, 15], origen: { 14: [4, 4], 15: [67.6, 4] } };
export const ANCHOS_COMPARADOR = [0.1, 0.2, 0.3, 0.5, 1, 2, 3];

/** Vértices (mm) del marcador id en la tarjeta: arriba-izq, arriba-der, abajo-der, abajo-izq (y hacia abajo). */
export function verticesMarcador(id) {
  const [x, y] = TARJETA.origen[id], L = TARJETA.lado;
  return [[x, y], [x + L, y], [x + L, y + L], [x, y + L]];
}

/**
 * Homografía por mínimos cuadrados (n ≥ 4 pares) con normalización de
 * Hartley: se centran los puntos y se escalan a distancia media √2 antes de
 * resolver el sistema 2n × 8 (h33 = 1) por ecuaciones normales.
 * Devuelve H (3×3) que lleva src → dst.
 */
export function homografiaMC(src, dst) {
  const norm = pts => {
    const n = pts.length, cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
    const dm = pts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / n || 1, k = Math.SQRT2 / dm;
    return { T: [[k, 0, -k * cx], [0, k, -k * cy], [0, 0, 1]], p: pts.map(p => [(p[0] - cx) * k, (p[1] - cy) * k]) };
  };
  const a = norm(src), b = norm(dst);
  const AtA = [...Array(8)].map(() => new Array(8).fill(0)), Atb = new Array(8).fill(0);
  const fila = (r, v) => { for (let i = 0; i < 8; i++) { Atb[i] += r[i] * v; for (let j = 0; j < 8; j++) AtA[i][j] += r[i] * r[j]; } };
  for (let i = 0; i < src.length; i++) {
    const [x, y] = a.p[i], [u, v] = b.p[i];
    fila([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    fila([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  const h = resolver(AtA, Atb);
  if (!h) return null;
  const Hn = [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
  // H = Tb⁻¹ · Hn · Ta
  const Tbi = inv3(b.T), H = mul3(mul3(Tbi, Hn), a.T);
  const s = H[2][2];
  return H.map(f => f.map(v => v / s));
}

export const aplicar = (H, x, y) => { const w = H[2][0] * x + H[2][1] * y + H[2][2]; return [(H[0][0] * x + H[0][1] * y + H[0][2]) / w, (H[1][0] * x + H[1][1] * y + H[1][2]) / w]; };
export const mul3 = (A, B) => A.map(f => [0, 1, 2].map(j => f[0] * B[0][j] + f[1] * B[1][j] + f[2] * B[2][j]));
export function inv3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}

/** Escala local (px por mm) de la homografía en el punto (x, y) en mm: raíz del determinante del jacobiano. */
export function escalaLocal(H, x, y, d = 0.5) {
  const p = aplicar(H, x, y), px = aplicar(H, x + d, y), py = aplicar(H, x, y + d);
  const J = [[(px[0] - p[0]) / d, (py[0] - p[0]) / d], [(px[1] - p[1]) / d, (py[1] - p[1]) / d]];
  return Math.sqrt(Math.abs(J[0][0] * J[1][1] - J[0][1] * J[1][0]));
}

/**
 * Busca la tarjeta en la foto (RGBA) y calcula la homografía tarjeta → foto.
 * Detecta en una copia reducida (rápido) y refina las esquinas a subpíxel en
 * la foto completa.
 */
export function buscarTarjeta(rgba, w, h, { ladoMax = 1600 } = {}) {
  const g = gris(rgba, w, h);
  const k = Math.min(1, ladoMax / Math.max(w, h));
  let marcas;
  if (k < 1) {
    const ws = Math.round(w * k), hs = Math.round(h * k), gs = new Uint8Array(ws * hs);
    for (let y = 0; y < hs; y++) for (let x = 0; x < ws; x++) gs[y * ws + x] = g[Math.min(h - 1, Math.round(y / k)) * w + Math.min(w - 1, Math.round(x / k))];
    marcas = detectar(gs, ws, hs).map(m => ({ ...m, esquinas: refinarEsquinas(g, w, h, m.esquinas.map(([x, y]) => [x / k, y / k])) }));
  } else marcas = detectar(g, w, h);
  const nuestras = marcas.filter(m => TARJETA.ids.includes(m.id));
  if (!nuestras.length) return { ok: false, gris: g, motivo: 'No se ve la tarjeta-regla. Póngala junto a la grieta, con buena luz, y tome la foto de frente a 15–25 cm.' };
  const src = [], dst = [];
  for (const m of nuestras) verticesMarcador(m.id).forEach((v, i) => { src.push(v); dst.push(m.esquinas[i]); });
  const H = homografiaMC(src, dst);
  if (!H) return { ok: false, gris: g, motivo: 'No se pudo calcular la perspectiva de la tarjeta.' };
  // calidad: error de reproyección (px) y perspectiva (lados de los marcadores)
  let e2 = 0;
  src.forEach((s, i) => { const p = aplicar(H, s[0], s[1]); e2 += (p[0] - dst[i][0]) ** 2 + (p[1] - dst[i][1]) ** 2; });
  const rms = Math.sqrt(e2 / src.length);
  const lados = nuestras.flatMap(m => m.esquinas.map((p, i) => Math.hypot(m.esquinas[(i + 1) % 4][0] - p[0], m.esquinas[(i + 1) % 4][1] - p[1])));
  const perspectiva = Math.max(...lados) / Math.min(...lados) - 1;
  const escala = escalaLocal(H, TARJETA.ancho / 2, TARJETA.alto / 2);
  const avisos = [];
  if (nuestras.length < 2) avisos.push('Solo se vio un marcador: la medida es menos precisa. Que se vean los dos.');
  if (perspectiva > 0.15) avisos.push('La foto está inclinada. Tómela más de frente al muro.');
  if (escala < 6) avisos.push(`Está lejos: ${escala.toFixed(1)} px por mm. Acérquese para medir grietas finas (ideal ≥ 10 px/mm).`);
  return { ok: true, gris: g, H, Hi: inv3(H), rms, perspectiva, escala, marcadores: nuestras.length, avisos, errorEscala: Math.min(0.1, rms / Math.max(1, escala * TARJETA.lado) + 0.005) };
}

/**
 * Rectifica una región de la tarjeta (mm, puede salirse de la tarjeta: es el
 * mismo plano del muro) a una imagen en gris con «escala» px/mm.
 */
export function rectificar(g, w, h, H, [x0, y0, x1, y1], escala) {
  const W = Math.max(8, Math.round((x1 - x0) * escala)), Hh = Math.max(8, Math.round((y1 - y0) * escala));
  const o = new Float32Array(W * Hh);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const [u, v] = aplicar(H, x0 + (i + 0.5) / escala, y0 + (j + 0.5) / escala);
    const val = muestra(g, w, h, u, v);
    o[j * W + i] = Number.isNaN(val) ? 255 : val;
  }
  return { img: o, w: W, h: Hh };
}

/* ---------------------- impresión de la tarjeta (PDF) ---------------------- */

/** Dibuja una tarjeta en un jsPDF en (ox, oy) mm. */
export function dibujarTarjeta(doc, ox, oy) {
  const T = TARJETA;
  doc.setDrawColor(150); doc.setLineWidth(0.15); doc.setLineDashPattern([1, 1], 0);
  doc.rect(ox, oy, T.ancho, T.alto); doc.setLineDashPattern([], 0);
  for (const id of T.ids) {
    const [mx, my] = T.origen[id], c = T.lado / 6, M = celdas(id);
    doc.setFillColor(0, 0, 0);
    M.forEach((f, r) => f.forEach((v, k) => { if (!v) doc.rect(ox + mx + k * c, oy + my + r * c, c, c, 'F'); }));
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0);
  doc.text('AXIONA · Tarjeta-regla', ox + T.ancho / 2, oy + 8.5, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2);
  doc.text('Péguela junto a la grieta y tome la foto de frente.', ox + T.ancho / 2, oy + 12.5, { align: 'center' });
  doc.text('Imprimir al 100 % (tamaño real).', ox + T.ancho / 2, oy + 15.6, { align: 'center' });
  // comparador de anchos
  let x = ox + 7;
  doc.setFontSize(5);
  for (const a of ANCHOS_COMPARADOR) {
    doc.setFillColor(0, 0, 0);
    doc.rect(x, oy + 22, a, 12, 'F');
    doc.text(String(a).replace('.', ','), x + a / 2, oy + 37.2, { align: 'center' });
    x += 10.5;
  }
  doc.text('mm', x - 2, oy + 37.2);
  // regla de 50 mm
  const rx = ox + (T.ancho - 50) / 2, ry = oy + 44;
  doc.setLineWidth(0.25); doc.setDrawColor(0);
  doc.line(rx, ry, rx + 50, ry);
  for (let i = 0; i <= 50; i++) doc.line(rx + i, ry, rx + i, ry - (i % 10 === 0 ? 3 : i % 5 === 0 ? 2 : 1.1));
  doc.setFontSize(5.4);
  doc.text('Esta regla mide 50 mm: compruébelo con una regla. Si no, anote cuánto mide en la app.', ox + T.ancho / 2, ry + 4.2, { align: 'center' });
  doc.setFontSize(4.6); doc.setTextColor(90);
  doc.text('Mide, no diagnostica: la evaluación la hace un profesional del RUPE.', ox + T.ancho / 2, ry + 7.4, { align: 'center' });
}

/** PDF A4 con 8 tarjetas (2 × 4) para recortar. */
export async function pdfTarjetas() {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const mx = (210 - 2 * TARJETA.ancho - 8) / 2, my = 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('AXIONA EVALÚA · Tarjetas-regla para medir grietas', 105, 10, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('Imprima con «Tamaño real» o «100 %» (no «Ajustar a la página»). Recorte por la línea punteada.', 105, 14.5, { align: 'center' });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) dibujarTarjeta(doc, mx + c * (TARJETA.ancho + 8), my + r * (TARJETA.alto + 12));
  return doc.output('blob');
}
