// Ecuaciones de ingeniería: NSR-10, sismo en el sitio, calendario, priorización, inclinómetro, tarjeta-regla y derechos.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { espectro, coeficientesSitio, perfilPorVs30, periodos, periodoAproximado } from '../src/sismo/nsr10.js';
import { sismoEnSitio, psaEn, demandaVsDiseno, textoMMI } from '../src/sismo/sitio.js';
import { bilineal, distancia, puntoEnPoligono } from '../src/nucleo/geo.js';
import { pascua, festivos, sumarHabiles, fecha, aISO, sumarMeses, habilesEntre, esHabil } from '../src/nucleo/calendario.js';
import { puntaje, PESOS_BASE } from '../src/nucleo/prioridad.js';
import { inclinacion, resumirLectura, lecturaDeriva } from '../src/medir/inclinometro.js';
import { homografiaMC, aplicar, buscarTarjeta, verticesMarcador, TARJETA, rectificar, escalaLocal } from '../src/medir/tarjeta.js';
import { leerGrieta, orientar, categoriaBRE } from '../src/medir/orientacion.js';
import { analizar, topeCanon, prorrogaContrato, plazoPeticion, vigencias } from '../src/derechos/motor.js';
import { CORPUS } from '../src/derechos/corpus.js';
import { redactarPeticion } from '../src/derechos/peticion.js';
import { CIUDADES, ciudadDe } from '../src/nucleo/ciudades.js';
import { celdas } from '../../axiona-obra/src/ar/vision/marcadores.js';

describe('NSR-10', () => {
  it('Fa y Fv interpolan las tablas A.2.4-3 y A.2.4-4', () => {
    expect(coeficientesSitio('D', 0.35, 0.35)).toEqual({ Fa: 1.15, Fv: 1.7 });
    expect(coeficientesSitio('D', 0.25, 0.25)).toEqual({ Fa: 1.3, Fv: 1.9 });
    expect(coeficientesSitio('E', 0.5, 0.5)).toEqual({ Fa: 0.9, Fv: 2.4 });
    expect(coeficientesSitio('F', 0.3, 0.3)).toBeNull();
  });
  it('espectro de Quibdó, suelo D: meseta, rama 1/T y rama 1/T²', () => {
    const p = { Aa: 0.35, Av: 0.35, ...coeficientesSitio('D', 0.35, 0.35), I: 1 };
    const { TC, TL } = periodos(p);
    expect(TC).toBeCloseTo(0.48 * 0.35 * 1.7 / (0.35 * 1.15), 6);
    expect(espectro(0.2, p)).toBeCloseTo(2.5 * 0.35 * 1.15, 6);
    expect(espectro(1.0, p)).toBeCloseTo(1.2 * 0.35 * 1.7 / 1.0, 6);
    expect(espectro(TL + 1, p)).toBeCloseTo(1.2 * 0.35 * 1.7 * TL / (TL + 1) ** 2, 6);
    // continuidad en TC
    expect(espectro(TC, p)).toBeCloseTo(1.2 * 0.35 * 1.7 / TC, 6);
  });
  it('perfil por Vs30 y período aproximado', () => {
    expect(perfilPorVs30(250)).toBe('D');
    expect(perfilPorVs30(150)).toBe('E');
    expect(perfilPorVs30(800)).toBe('B');
    expect(periodoAproximado(10, 'porticosConcreto')).toBeCloseTo(0.047 * 10 ** 0.9, 6);
  });
});

describe('sismo en el sitio (ShakeMap us6000tjl2)', () => {
  const malla = JSON.parse(readFileSync(new URL('../public/sismo/quibdo.json', import.meta.url)));
  const pereira = JSON.parse(readFileSync(new URL('../public/sismo/pereira.json', import.meta.url)));
  it('bilineal reproduce los nodos y promedia entre ellos', () => {
    const m = { lon0: 0, lat0: 1, dlon: 1, dlat: 1, nlon: 2, nlat: 2 };
    const v = [0, 10, 20, 30];
    expect(bilineal(m, v, 0, 1)).toBe(0);
    expect(bilineal(m, v, 1, 0)).toBe(30);
    expect(bilineal(m, v, 0.5, 0.5)).toBe(15);
    expect(bilineal(m, [0, null, 20, 30], 0.5, 0.5)).toBeCloseTo((0 + 20 + 30) / 3, 6);
    expect(bilineal(m, v, 2, 0)).toBeNull();
  });
  it('Quibdó centro: MMI entre 6 y 8, PSA coherentes', () => {
    const s = sismoEnSitio(malla, CIUDADES.quibdo.centro);
    expect(s.mmi).toBeGreaterThan(6);
    expect(s.mmi).toBeLessThan(8);
    expect(s.pga).toBeGreaterThan(5);
    expect(psaEn(0, s)).toBe(s.pga);
    expect(psaEn(0.3, s)).toBeCloseTo(s.psa[0.3], 6);
    const t = psaEn(0.45, s);
    expect(t).toBeGreaterThan(Math.min(s.psa[0.3], s.psa[0.6]) - 1e-9);
    expect(t).toBeLessThan(Math.max(s.psa[0.3], s.psa[0.6]) + 1e-9);
  });
  it('Pereira tuvo más sacudida que Quibdó (más cerca del epicentro)', () => {
    const q = sismoEnSitio(malla, CIUDADES.quibdo.centro), p = sismoEnSitio(pereira, CIUDADES.pereira.centro);
    expect(p.mmi).toBeGreaterThan(q.mmi);
  });
  it('demanda contra diseño: razón positiva y lectura', () => {
    const s = sismoEnSitio(pereira, CIUDADES.pereira.centro);
    const d = demandaVsDiseno(s, CIUDADES.pereira.nsr10, { alturaM: 6, sistema: 'confinada', perfil: 'D' });
    expect(d.r).toBeGreaterThan(0);
    expect(d.Sa).toBeCloseTo(2.5 * 0.25 * 1.3, 6);
    expect(typeof d.lectura).toBe('string');
  });
  it('fuera de la malla no inventa datos', () => {
    expect(sismoEnSitio(malla, { lat: 10, lon: -70 })).toBeNull();
  });
  it('texto MMI', () => {
    expect(textoMMI(7.2).romano).toBe('VII');
    expect(textoMMI(4).dano).toBe('sin daño esperado');
  });
});

describe('geo', () => {
  it('haversine: Quibdó–Pereira ≈ 145 km en línea recta', () => {
    const d = distancia(CIUDADES.quibdo.centro, CIUDADES.pereira.centro) / 1000;
    expect(d).toBeGreaterThan(138); expect(d).toBeLessThan(152);
  });
  it('punto en polígono y ciudad', () => {
    expect(puntoEnPoligono(0.5, 0.5, [[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(true);
    expect(puntoEnPoligono(1.5, 0.5, [[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(false);
    expect(ciudadDe({ lat: 4.81, lon: -75.69 }).id).toBe('pereira');
    expect(ciudadDe({ lat: 5.69, lon: -76.65 }).id).toBe('quibdo');
    expect(ciudadDe({ lat: 11, lon: -74 })).toBeNull();
  });
});

describe('calendario de Colombia', () => {
  it('Pascua (Meeus)', () => {
    expect(aISO(pascua(2026))).toBe('2026-04-05');
    expect(aISO(pascua(2027))).toBe('2027-03-28');
  });
  it('festivos 2026 trasladados a lunes', () => {
    const F = festivos(2026);
    expect(F.get('2026-01-12')).toBe('Reyes Magos');      // 6 ene (mar) → lun 12
    expect(F.get('2026-08-17')).toBe('Asunción de la Virgen'); // 15 ago (sáb) → lun 17
    expect(F.get('2026-11-02')).toBe('Todos los Santos');
    expect(F.get('2026-11-16')).toBe('Independencia de Cartagena');
    expect(F.get('2026-04-03')).toBe('Viernes Santo');
    expect(F.get('2026-05-18')).toBe('Ascensión del Señor');
    expect(F.size).toBe(18);
  });
  it('días hábiles saltan fines de semana y festivos', () => {
    // viernes 13-nov-2026 + 1 hábil = martes 17 (lunes 16 es festivo)
    expect(aISO(sumarHabiles(fecha(2026, 11, 13), 1))).toBe('2026-11-17');
    expect(esHabil(fecha(2026, 11, 16))).toBe(false);
    expect(habilesEntre(fecha(2026, 11, 13), fecha(2026, 11, 20))).toBe(4);
  });
  it('meses calendario con fin de mes', () => {
    expect(aISO(sumarMeses(fecha(2026, 8, 31), 6))).toBe('2027-02-28');
    expect(aISO(sumarMeses(fecha(2026, 9, 18), 6))).toBe('2027-03-18');
  });
});

describe('priorización', () => {
  const base = { creado: '2026-11-01T00:00:00Z', vivienda: { sistema: 'confinada' }, hogar: {}, senales: {}, sismo: { mmi: 6, licuacion: 0, deslizamiento: 0 } };
  const hoy = new Date('2026-11-15T00:00:00Z');
  it('los pesos base suman 1', () => {
    expect(Object.values(PESOS_BASE).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
  it('una señal grave da piso de 80', () => {
    expect(puntaje({ ...base, senales: { colapso: true } }, { hoy }).puntaje).toBeGreaterThanOrEqual(80);
  });
  it('más sacudida, más prioridad; los aportes suman el puntaje', () => {
    const a = puntaje(base, { hoy }), b = puntaje({ ...base, sismo: { mmi: 8 } }, { hoy });
    expect(b.puntaje).toBeGreaterThan(a.puntaje);
    expect(Object.values(a.aportes).reduce((x, y) => x + y, 0)).toBeCloseTo(a.puntaje, 0);
  });
  it('hogar con niños y discapacidad sube', () => {
    expect(puntaje({ ...base, hogar: { menores: 2, discapacidad: 1, personas: 6 } }, { hoy }).puntaje).toBeGreaterThan(puntaje(base, { hoy }).puntaje);
  });
});

describe('inclinómetro por inversión', () => {
  const g = 9.81;
  const lectura = (x, y, z) => resumirLectura(Array.from({ length: 50 }, () => [x, y, z]));
  it('muro: cancela el sesgo del sensor', () => {
    const th = 0.6 * Math.PI / 180, b = 0.12;
    const l1 = lectura(0, g * Math.cos(th), -g * Math.sin(th) + b), l2 = lectura(0, g * Math.cos(th), g * Math.sin(th) + b);
    const r = inclinacion('muro', l1, l2, 3);
    expect(r.grados).toBeCloseTo(0.6, 3);
    expect(r.deriva).toBeCloseTo(Math.tan(th) * 100, 3);
    expect(r.desplomeMm).toBeCloseTo(Math.tan(th) * 3000, 2);
    expect(r.sesgoSensor).toBeCloseTo(b, 6);
  });
  it('columna: en el plano, con inversión 180°', () => {
    const ph = 1.2 * Math.PI / 180, b = -0.08;
    const l1 = lectura(g * Math.sin(ph) + b, g * Math.cos(ph), 0), l2 = lectura(-g * Math.sin(ph) + b, -g * Math.cos(ph), 0);
    expect(inclinacion('columna', l1, l2, 2.5).grados).toBeCloseTo(1.2, 3);
  });
  it('lectura de la deriva (FEMA P-58)', () => {
    expect(lecturaDeriva(0.1).nivel).toBe('tolerancia');
    expect(lecturaDeriva(0.3).nivel).toBe('revision');
    expect(lecturaDeriva(0.7).nivel).toBe('alerta');
  });
});

/** Dibuja la tarjeta (solo los marcadores) en una imagen RGBA con la homografía H tarjeta→imagen. */
function fotoTarjeta(H, w, h) {
  const Hi = homografiaMC([[0, 0], [w, 0], [w, h], [0, h]].map(p => p), [[0, 0], [w, 0], [w, h], [0, h]]); // identidad (prueba del solver)
  expect(Hi[0][0]).toBeCloseTo(1, 9);
  const inv = m => { const [[a, b, c], [d, e, f], [g2, hh, i]] = m; const A = e * i - f * hh, B = -(d * i - f * g2), C = d * hh - e * g2, det = a * A + b * B + c * C; return [[A / det, -(b * i - c * hh) / det, (b * f - c * e) / det], [B / det, (a * i - c * g2) / det, -(a * f - c * d) / det], [C / det, -(a * hh - b * g2) / det, (a * e - b * d) / det]]; };
  const Ht = inv(H);
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      const [mx, my] = aplicar(Ht, x + 0.25 + sx * 0.5, y + 0.25 + sy * 0.5);
      let c = 200; // muro claro
      if (mx >= 0 && my >= 0 && mx <= TARJETA.ancho && my <= TARJETA.alto) c = 245; // papel
      for (const id of TARJETA.ids) {
        const [ox, oy] = TARJETA.origen[id], k = TARJETA.lado / 6;
        const cx = Math.floor((mx - ox) / k), cy = Math.floor((my - oy) / k);
        if (cx >= 0 && cy >= 0 && cx < 6 && cy < 6 && !celdas(id)[cy][cx]) c = 20;
      }
      v += c / 4;
    }
    const i = (y * w + x) * 4; rgba[i] = rgba[i + 1] = rgba[i + 2] = v; rgba[i + 3] = 255;
  }
  return rgba;
}

describe('tarjeta-regla', () => {
  it('homografía por mínimos cuadrados recupera una transformación conocida', () => {
    const H = [[8.1, 0.6, 120], [-0.4, 7.7, 90], [0.0006, -0.0004, 1]];
    const src = [...verticesMarcador(14), ...verticesMarcador(15)];
    const dst = src.map(p => aplicar(H, p[0], p[1]));
    const E = homografiaMC(src, dst);
    for (const p of [[40, 30], [0, 0], [85, 54]]) { const a = aplicar(H, ...p), b = aplicar(E, ...p); expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-6); }
  });
  it('encuentra la tarjeta en una foto sintética y da la escala en px/mm', () => {
    const H = [[9, 0.8, 140], [-0.5, 8.6, 110], [0.0004, 0.0002, 1]];
    const w = 1100, h = 760, rgba = fotoTarjeta(H, w, h);
    const r = buscarTarjeta(rgba, w, h);
    expect(r.ok).toBe(true);
    expect(r.marcadores).toBe(2);
    expect(r.rms).toBeLessThan(0.8);
    const real = escalaLocal(H, TARJETA.ancho / 2, TARJETA.alto / 2);
    expect(Math.abs(r.escala - real) / real).toBeLessThan(0.02);
    // la rectificación mapea el papel a 245
    const rec = rectificar(r.gris, w, h, r.H, [30, 40, 50, 50], 8);
    expect(rec.img[Math.floor(rec.h / 2) * rec.w + Math.floor(rec.w / 2)]).toBeGreaterThan(230);
  });
});

describe('orientación al ciudadano (sin semáforo oficial)', () => {
  it('BRE 251', () => {
    expect(categoriaBRE(0.05).cat).toBe(0);
    expect(categoriaBRE(3).cat).toBe(2);
    expect(categoriaBRE(20).cat).toBe(4);
  });
  it('diagonal en columna = alerta aunque sea fina', () => {
    expect(leerGrieta({ elemento: 'columna', patron: 'diagonal', anchoMm: 0.4 }).nivel).toBe('alerta');
  });
  it('muro divisorio con 2 mm = sin señales; muro portante diagonal 2 mm = revisión', () => {
    expect(leerGrieta({ elemento: 'muroDivisorio', patron: 'vertical', anchoMm: 2 }).nivel).toBe('sin_senales');
    expect(leerGrieta({ elemento: 'muroPortante', patron: 'diagonal', anchoMm: 2 }).nivel).toBe('revision');
  });
  it('grieta que crece = alerta', () => {
    expect(leerGrieta({ elemento: 'muroDivisorio', patron: 'vertical', anchoMm: 1.2, previaMm: 0.6 }).nivel).toBe('alerta');
  });
  it('olor a gas: alerta con acción concreta', () => {
    const o = orientar({ senales: { gas: true } });
    expect(o.nivel).toBe('alerta');
    expect(o.acciones.join(' ')).toMatch(/gas/);
  });
});

describe('derechos', () => {
  const hoy = fecha(2026, 11, 15);
  it('todas las citas del motor existen en el corpus', () => {
    const ids = new Set(CORPUS.map(c => c.id));
    const casos = [{ rol: 'arrendatario', estado: 'no_habitable', enRUD: 'no', contratoVence: '2026-11-30', ultimoCanon: 800000, ipc: 5.2, desalojo: true }, { rol: 'ph', ph: true }, { rol: 'poseedor', necesitaLicencia: true }, { rol: 'arrendador' }];
    for (const s of casos) for (const d of analizar(s, { hoy }).derechos) for (const c of d.citas) expect(ids.has(c), c).toBe(true);
  });
  it('arrendatario: suspensión de desalojos, prórroga y tope del canon', () => {
    const r = analizar({ rol: 'arrendatario', enRUD: 'si', contratoVence: '2026-11-30', ultimoCanon: 800000, ipc: 5.2 }, { hoy });
    const ids = r.derechos.map(d => d.id);
    expect(ids).toContain('desalojo'); expect(ids).toContain('prorroga'); expect(ids).toContain('tope');
    expect(r.derechos.find(d => d.id === 'tope').calculo.tope).toBe(841600);
    expect(aISO(vigencias().arriendoHasta)).toBe('2027-03-17');
  });
  it('contrato fuera del periodo no se prorroga', () => {
    expect(prorrogaContrato('2027-02-01').aplica).toBe(false);
    expect(aISO(prorrogaContrato('2026-10-15').nuevaFecha)).toBe('2027-04-15');
  });
  it('tope del canon y plazo de petición en días hábiles', () => {
    expect(topeCanon(1000000, 5)).toBe(1050000);
    expect(aISO(plazoPeticion('2026-11-13').vence)).toBe('2026-12-07');
  });
  it('desalojo en curso o personas vulnerables: escalar', () => {
    const r = analizar({ rol: 'arrendatario', desalojo: true, vulnerables: true }, { hoy });
    expect(r.escalar).toBe(true);
    expect(r.motivosEscalamiento.length).toBeGreaterThanOrEqual(2);
  });
  it('la petición lleva hechos, peticiones y fundamentos', () => {
    const t = redactarPeticion({ ciudad: 'Quibdó', nombre: 'Ana Mosquera', documento: '123', direccion: 'Cra 4 # 20-10', peticiones: ['evaluacion', 'rud'] }, { senales: { columnas: true }, grietas: [{ ultima: { anchoMm: 2.5 } }] });
    expect(t).toMatch(/HECHOS/); expect(t).toMatch(/Ley 1755 de 2015/); expect(t).toMatch(/2,5 mm/); expect(t).toMatch(/Registro Único de Damnificados/);
  });
});
