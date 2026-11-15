// Gráficas SVG livianas (sin librerías).
import { espectro } from '../sismo/nsr10.js';
import { psaEn } from '../sismo/sitio.js';

/** Espectro de diseño NSR-10 contra la demanda del sismo (PSA del ShakeMap) y el período de la edificación. */
export function graficaEspectro(d, s, { ancho = 560, alto = 260 } = {}) {
  const m = { i: 44, d: 12, a: 14, b: 34 }, W = ancho - m.i - m.d, H = alto - m.a - m.b;
  const Tmax = 3.2, N = 160;
  const dis = [...Array(N + 1)].map((_, k) => { const T = Tmax * k / N; return [T, espectro(T, d)]; });
  const dem = [...Array(N + 1)].map((_, k) => { const T = Tmax * k / N; const v = psaEn(T, s); return [T, v === null ? null : v / 100]; }).filter(p => p[1] !== null);
  const ymax = Math.max(...dis.map(p => p[1]), ...dem.map(p => p[1])) * 1.15;
  const X = T => m.i + W * T / Tmax, Y = a => m.a + H * (1 - a / ymax);
  const linea = pts => pts.map(([t, a], k) => `${k ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(a).toFixed(1)}`).join('');
  const ticksY = [...Array(5)].map((_, k) => ymax * k / 4);
  const ticksX = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  const puntos = [[0, s.pga], [0.3, s.psa[0.3]], [0.6, s.psa[0.6]], [1, s.psa[1]], [3, s.psa[3]]].filter(p => p[1] > 0);
  return `<svg viewBox="0 0 ${ancho} ${alto}" style="width:100%;height:auto" role="img" aria-label="Espectro de diseño NSR-10 contra la demanda del sismo">
    ${ticksY.map(a => `<line x1="${m.i}" x2="${m.i + W}" y1="${Y(a)}" y2="${Y(a)}" stroke="#1b2a3b"/><text x="${m.i - 6}" y="${Y(a) + 4}" fill="#5f7389" font-size="10" text-anchor="end">${a.toFixed(2)}</text>`).join('')}
    ${ticksX.map(t => `<text x="${X(t)}" y="${alto - 14}" fill="#5f7389" font-size="10" text-anchor="middle">${t}</text>`).join('')}
    <text x="${m.i + W / 2}" y="${alto - 2}" fill="#93a6bb" font-size="10.5" text-anchor="middle">Período T (s)</text>
    <text x="10" y="${m.a + H / 2}" fill="#93a6bb" font-size="10.5" text-anchor="middle" transform="rotate(-90 10 ${m.a + H / 2})">Sa (g)</text>
    <path d="${linea(dis)}" fill="none" stroke="#2f7bff" stroke-width="2.4"/>
    <path d="${linea(dem)}" fill="none" stroke="#ff9f43" stroke-width="2" stroke-dasharray="5 4"/>
    ${puntos.map(([t, a]) => `<circle cx="${X(t)}" cy="${Y(a / 100)}" r="3.6" fill="#ff9f43"/>`).join('')}
    <line x1="${X(d.T)}" x2="${X(d.T)}" y1="${m.a}" y2="${m.a + H}" stroke="#19d3c5" stroke-dasharray="3 3"/>
    <text x="${Math.min(X(d.T) + 5, m.i + W - 80)}" y="${m.a + 12}" fill="#19d3c5" font-size="11">T ≈ ${d.T.toFixed(2)} s</text>
    <g font-size="11"><rect x="${m.i + W - 196}" y="${m.a + 4}" width="192" height="40" rx="8" fill="#0b121b" stroke="#1b2a3b"/>
      <line x1="${m.i + W - 186}" x2="${m.i + W - 164}" y1="${m.a + 17}" y2="${m.a + 17}" stroke="#2f7bff" stroke-width="2.4"/><text x="${m.i + W - 158}" y="${m.a + 21}" fill="#c9d6e4">Diseño NSR-10 (suelo ${d.perfil})</text>
      <line x1="${m.i + W - 186}" x2="${m.i + W - 164}" y1="${m.a + 33}" y2="${m.a + 33}" stroke="#ff9f43" stroke-width="2" stroke-dasharray="5 4"/><text x="${m.i + W - 158}" y="${m.a + 37}" fill="#c9d6e4">Sismo 10-ago (ShakeMap)</text></g>
  </svg>`;
}

/** Barras horizontales simples: [[etiqueta, valor, max]] */
export const barras = filas => `<div class="barras">${filas.map(([t, v, max, txt]) => `<div class="barrita"><span>${t}</span><span class="pista"><i style="width:${Math.max(2, Math.min(100, 100 * v / (max || 1)))}%"></i></span><b>${txt ?? Math.round(v)}</b></div>`).join('')}</div>`;
