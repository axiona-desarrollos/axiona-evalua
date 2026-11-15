/* ==========================================================================
   AXIONA EVALÚA · Operaciones de imagen (puras, sin DOM)
   --------------------------------------------------------------------------
   Imágenes en gris como Float32Array (fila por fila). Todo corre igual en el
   navegador, en un Web Worker y en las pruebas de Node.
   ========================================================================== */

/** Muestra bilineal; fuera de la imagen devuelve NaN. */
export function muestra(g, w, h, x, y) {
  if (!(x >= 0 && y >= 0 && x <= w - 1 && y <= h - 1)) return NaN;
  const x0 = Math.min(Math.floor(x), w - 2), y0 = Math.min(Math.floor(y), h - 2);
  const tx = x - x0, ty = y - y0, i = y0 * w + x0;
  return (g[i] * (1 - tx) + g[i + 1] * tx) * (1 - ty) + (g[i + w] * (1 - tx) + g[i + w + 1] * tx) * ty;
}

/** Suavizado binomial 3×3 (≈ gaussiana σ 0,85 px). */
export function suavizar(g, w, h) {
  const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = g[y * w + Math.max(0, x - 1)], c = g[y * w + Math.min(w - 1, x + 1)];
    t[i] = (a + 2 * g[i] + c) / 4;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = t[Math.max(0, y - 1) * w + x], c = t[Math.min(h - 1, y + 1) * w + x];
    o[i] = (a + 2 * t[i] + c) / 4;
  }
  return o;
}

/**
 * Filtro de máximo o mínimo en una ventana 1D de k muestras (k impar) con el
 * algoritmo de van Herk / Gil-Werman: O(1) por muestra sin importar k.
 */
function filtro1D(src, n, k, max, out) {
  const r = (k - 1) >> 1, m = n + 2 * r, ext = new Float32Array(m), pre = new Float32Array(m), suf = new Float32Array(m);
  const neutro = max ? -Infinity : Infinity, op = max ? Math.max : Math.min;
  // bordes en espejo: el fondo cerca del borde no queda sesgado por la iluminación
  for (let i = 0; i < m; i++) { let j = i - r; if (j < 0) j = -j; if (j >= n) j = 2 * n - 2 - j; ext[i] = j < 0 || j >= n ? neutro : src[j]; }
  for (let i = 0; i < m; i++) pre[i] = i % k === 0 ? ext[i] : op(pre[i - 1], ext[i]);
  for (let i = m - 1; i >= 0; i--) suf[i] = i === m - 1 || (i + 1) % k === 0 ? ext[i] : op(suf[i + 1], ext[i]);
  for (let i = 0; i < n; i++) out[i] = op(suf[i], pre[i + k - 1]);
  return out;
}

/** Máximo (dilatación) o mínimo (erosión) en una ventana cuadrada k×k. */
export function filtroCuadrado(g, w, h, k, max) {
  const o = new Float32Array(w * h), fila = new Float32Array(w), filaO = new Float32Array(w), col = new Float32Array(h), colO = new Float32Array(h);
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) fila[x] = g[y * w + x]; filtro1D(fila, w, k, max, filaO); for (let x = 0; x < w; x++) o[y * w + x] = filaO[x]; }
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) col[y] = o[y * w + x]; filtro1D(col, h, k, max, colO); for (let y = 0; y < h; y++) o[y * w + x] = colO[y]; }
  return o;
}

/** Media en una ventana cuadrada k×k (imagen integral). */
export function mediaCaja(g, w, h, k) {
  const r = k >> 1, W = w + 1, I = new Float64Array(W * (h + 1)), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { let f = 0; for (let x = 0; x < w; x++) { f += g[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + f; } }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      o[y * w + x] = (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
    }
  }
  return o;
}

/** Cierre morfológico en gris (máximo y luego mínimo): borra los valles oscuros más angostos que k. */
export const cierre = (g, w, h, k) => filtroCuadrado(filtroCuadrado(g, w, h, k, true), w, h, k, false);

/** Mediana y MAD (desviación absoluta mediana) de una muestra. */
export function medianaMAD(v) {
  const a = Float32Array.from(v).sort();
  const med = a[a.length >> 1];
  const d = a.map(x => Math.abs(x - med)).sort();
  return { med, mad: d[d.length >> 1] };
}

export function percentil(v, p) {
  if (!v.length) return NaN;
  const a = [...v].sort((x, y) => x - y), i = (a.length - 1) * p, i0 = Math.floor(i);
  return i0 + 1 < a.length ? a[i0] + (a[i0 + 1] - a[i0]) * (i - i0) : a[i0];
}

/** Componentes conexas (8-vecinos) de una máscara; devuelve etiquetas y lista de componentes. */
export function componentesConexas(m, w, h) {
  const et = new Int32Array(w * h), pila = new Int32Array(w * h), comps = [];
  for (let i0 = 0; i0 < w * h; i0++) {
    if (!m[i0] || et[i0]) continue;
    const id = comps.length + 1, px = [];
    let sp = 0; pila[sp++] = i0; et[i0] = id;
    while (sp) {
      const i = pila[--sp], x = i % w, y = (i - x) / w;
      px.push(i);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (m[j] && !et[j]) { et[j] = id; pila[sp++] = j; }
      }
    }
    comps.push({ id, px });
  }
  return { et, comps };
}

/** Adelgazamiento de Zhang–Suen: esqueleto de 1 píxel de una máscara (se modifica en sitio). */
export function esqueleto(m, w, h) {
  const b = Uint8Array.from(m);
  const P = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : b[y * w + x]);
  let cambio = true;
  const borrar = [];
  while (cambio) {
    cambio = false;
    for (let paso = 0; paso < 2; paso++) {
      borrar.length = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!b[y * w + x]) continue;
        const p2 = P(x, y - 1), p3 = P(x + 1, y - 1), p4 = P(x + 1, y), p5 = P(x + 1, y + 1), p6 = P(x, y + 1), p7 = P(x - 1, y + 1), p8 = P(x - 1, y), p9 = P(x - 1, y - 1);
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const s = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let A = 0; for (let k = 0; k < 8; k++) if (!s[k] && s[k + 1]) A++;
        if (A !== 1) continue;
        if (paso === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
        borrar.push(y * w + x);
      }
      if (borrar.length) { cambio = true; for (const i of borrar) b[i] = 0; }
    }
  }
  return b;
}

/**
 * Transformada de distancia euclidiana exacta (Felzenszwalb–Huttenlocher):
 * distancia (px) de cada píxel de la máscara al fondo más cercano.
 */
export function distanciaAlFondo(m, w, h) {
  const INF = 1e20, f = new Float64Array(Math.max(w, h)), d = new Float64Array(Math.max(w, h)), v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  const D = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) D[i] = m[i] ? INF : 0;
  const dt1 = n => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = D[y * w + x]; dt1(h); for (let y = 0; y < h; y++) D[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = D[y * w + x]; dt1(w); for (let x = 0; x < w; x++) D[y * w + x] = d[x]; }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(D[i]);
  return out;
}
