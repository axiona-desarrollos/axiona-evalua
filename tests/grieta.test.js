// Medición de grietas sobre imágenes sintéticas de ancho conocido.
import { describe, it, expect } from 'vitest';
import { medirGrieta, direccion } from '../src/medir/grieta.js';
import { filtroCuadrado, distanciaAlFondo, esqueleto } from '../src/medir/imagen.js';

/** Muro sintético: gris 180 con gradiente de luz, ruido y una grieta recta de ancho W px (antialias + desenfoque σ). */
function muro({ w = 360, h = 300, W = 6, ang = 35, oscuro = 75, ruido = 3, sigma = 1.0, semillaRuido = 7 } = {}) {
  let s = semillaRuido;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const a = ang * Math.PI / 180, nx = -Math.sin(a), ny = Math.cos(a), cx = w / 2, cy = h / 2;
  const img = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let cub = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const d = Math.abs((x + (sx + 0.5) / 4 - cx) * nx + (y + (sy + 0.5) / 4 - cy) * ny);
      if (d < W / 2) cub++;
    }
    const base = 165 + 30 * x / w;
    img[y * w + x] = base - oscuro * cub / 16;
  }
  // desenfoque gaussiano separable
  const r = Math.ceil(3 * sigma), k = [];
  for (let i = -r; i <= r; i++) k.push(Math.exp(-i * i / (2 * sigma * sigma)));
  const sk = k.reduce((p, q) => p + q, 0);
  const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let i = -r; i <= r; i++) v += k[i + r] * img[y * w + Math.min(w - 1, Math.max(0, x + i))]; t[y * w + x] = v / sk; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let i = -r; i <= r; i++) v += k[i + r] * t[Math.min(h - 1, Math.max(0, y + i)) * w + x]; o[y * w + x] = v / sk + ruido * gauss(); }
  return { img: o, w, h };
}

describe('operaciones de imagen', () => {
  it('filtro de máximo y mínimo por van Herk/Gil-Werman coincide con la fuerza bruta', () => {
    const w = 23, h = 17, g = new Float32Array(w * h).map((_, i) => (i * 7919) % 97);
    for (const k of [3, 5, 9]) {
      const M = filtroCuadrado(g, w, h, k, true), r = (k - 1) / 2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let mx = -Infinity;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) mx = Math.max(mx, g[Y * w + X]); }
        expect(M[y * w + x]).toBe(mx);
      }
    }
  });
  it('la distancia al fondo es exacta en un cuadrado', () => {
    const w = 21, h = 21, m = new Uint8Array(w * h);
    for (let y = 5; y <= 15; y++) for (let x = 5; x <= 15; x++) m[y * w + x] = 1;
    const D = distanciaAlFondo(m, w, h);
    expect(D[10 * w + 10]).toBeCloseTo(6, 5);
    expect(D[5 * w + 10]).toBeCloseTo(1, 5);
  });
  it('el esqueleto de una barra es una línea de un píxel', () => {
    const w = 40, h = 15, m = new Uint8Array(w * h);
    for (let y = 5; y <= 9; y++) for (let x = 3; x <= 36; x++) m[y * w + x] = 1;
    const s = esqueleto(m, w, h);
    for (let x = 8; x <= 30; x++) { let n = 0; for (let y = 0; y < h; y++) n += s[y * w + x]; expect(n).toBe(1); }
  });
  it('dirección principal', () => {
    const d = direccion([[0, 0], [1, 1], [2, 2], [3, 3]]);
    expect(Math.abs(d[0])).toBeCloseTo(Math.SQRT1_2, 5);
  });
});

describe('ancho de grieta (10 px/mm)', () => {
  const escala = 10;
  for (const W of [4, 6, 10, 20, 40]) {
    it(`grieta resuelta de ${W / escala} mm`, () => {
      const { img, w, h } = muro({ W });
      const r = medirGrieta(img, w, h, { escala, semilla: [w / 2, h / 2], maxAnchoMm: 6 });
      expect(r.ok).toBe(true);
      const real = W / escala;
      expect(Math.abs(r.anchoMm - real)).toBeLessThanOrEqual(Math.max(0.12 * real, 0.08));
      expect(r.rango[0]).toBeLessThanOrEqual(real + 1e-9);
      expect(r.rango[1]).toBeGreaterThanOrEqual(real - 1e-9);
      expect(r.anguloHorizontal).toBeGreaterThanOrEqual(30);
      expect(r.anguloHorizontal).toBeLessThanOrEqual(40);
    });
  }
  it('grieta fina no resuelta (0,15 mm = 1,5 px): da una cota superior, del lado seguro', () => {
    const { img, w, h } = muro({ W: 1.5, oscuro: 90 });
    const r = medirGrieta(img, w, h, { escala, semilla: [w / 2, h / 2] });
    expect(r.ok).toBe(true);
    expect(r.noResuelta).toBe(true);
    expect(r.anchoMm).toBeGreaterThanOrEqual(0.15);
    expect(r.anchoMm).toBeLessThanOrEqual(0.4);
    expect(r.rango[0]).toBe(0);
  });
  it('grieta que se abre: las partes anchas calibran las angostas', () => {
    // dos tramos: 1,5 px y 8 px, en la misma grieta
    const a = muro({ W: 1.5, oscuro: 75 }), b = muro({ W: 8, oscuro: 75 });
    const img = a.img.map((v, i) => ((i % a.w) < a.w / 2 ? v : b.img[i]));
    const r = medirGrieta(img, a.w, a.h, { escala, semilla: [a.w / 2, a.h / 2] });
    expect(r.ok).toBe(true);
    expect(r.noResuelta).toBe(false);
    expect(r.anchoMm).toBeGreaterThanOrEqual(0.7);
    expect(r.anchoMm).toBeLessThanOrEqual(0.9);
  });
  it('largo de la grieta ≈ el trazo visible', () => {
    const { img, w, h } = muro({ W: 6, ang: 0 });
    const r = medirGrieta(img, w, h, { escala });
    expect(r.ok).toBe(true);
    expect(r.largoMm).toBeGreaterThan(30);
    expect(r.largoMm).toBeLessThanOrEqual(36.5);
  });
  it('muro sin grieta: no inventa una', () => {
    const { img, w, h } = muro({ W: 0 });
    const r = medirGrieta(img, w, h, { escala });
    expect(r.ok).toBe(false);
  });
});
