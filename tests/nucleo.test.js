import { describe, it, expect } from 'vitest';
import { nuevaEvaluacion, faltantes, puedeFirmar, CARTELES, CONDICIONES } from '../src/formulario.js';
import { preclasificar } from '../src/reglas.js';
import { viviendasDemo, evaluacionesDemo } from '../src/datos.js';
import { csvEDAN, csvRUD } from '../src/exportar.js';

const viv = viviendasDemo(12);
const ev0 = () => nuevaEvaluacion(viv[0], { nombre: 'Ing. Prueba', profesion: 'Ingeniero civil', matricula: 'CHO-1', rupe: 'RUPE-1', perfil: 'P1' });
const completa = () => {
  const e = ev0();
  e.edificacion.sistema = 'confinada'; e.ubicacion.gps = true; e.fotos.fachada = 'data:image/jpeg;base64,AA';
  e.hogar.consentimiento = true; e.decision.cartel = 'verde';
  return e;
};

describe('Formulario y firma', () => {
  it('una evaluación nueva no se puede firmar y dice qué falta', () => {
    const f = faltantes(ev0());
    expect(f).toEqual(expect.arrayContaining(['Sistema estructural', 'Ubicación GPS tomada en sitio', 'Foto de la fachada principal', 'Cartel asignado por el evaluador']));
    expect(puedeFirmar(ev0())).toBe(false);
  });
  it('con lo mínimo y cartel verde se puede firmar', () => expect(puedeFirmar(completa())).toBe(true));
  it('si hay daño exige la foto del daño, y amarillo o rojo exigen restricciones', () => {
    const e = completa(); e.condiciones.muros = 'moderado'; e.decision.cartel = 'amarillo';
    expect(faltantes(e)).toEqual(expect.arrayContaining(['Foto del daño principal', 'Restricciones de uso']));
  });
  it('sin matrícula del evaluador no se firma', () => { const e = completa(); e.evaluador.matricula = ''; expect(puedeFirmar(e)).toBe(false); });
});

describe('Preclasificación sin conexión (sugerencia, nunca decisión)', () => {
  it('sin daños sugiere verde con confianza baja', () => expect(preclasificar(ev0())).toMatchObject({ cartel: 'verde', confianza: 'baja', origen: 'reglas' }));
  it('condición crítica moderada (colapso, desplome, estructura, terreno) sugiere rojo', () => {
    for (const c of CONDICIONES.filter(x => x.critica)) { const e = ev0(); e.condiciones[c.id] = 'moderado'; expect(preclasificar(e).cartel, c.id).toBe('rojo'); }
  });
  it('grietas moderadas en muros sugieren amarillo y fase 2', () => { const e = ev0(); e.condiciones.muros = 'moderado'; expect(preclasificar(e)).toMatchObject({ cartel: 'amarillo', fase2: true }); });
  it('cualquier condición severa sugiere rojo', () => { const e = ev0(); e.condiciones.caida = 'severo'; expect(preclasificar(e).cartel).toBe('rojo'); });
  it('mampostería no reforzada con daño leve sube a amarillo', () => { const e = ev0(); e.edificacion.sistema = 'noReforzada'; e.condiciones.cubierta = 'leve'; expect(preclasificar(e).cartel).toBe('amarillo'); });
  it('el rojo se explica como no demolición en el texto oficial', () => expect(CARTELES.rojo.texto).toMatch(/No es una orden de demolición/));
});

describe('Datos de demostración y exportaciones', () => {
  it('las viviendas de demostración son siempre las mismas y quedan cerca de Quibdó', () => {
    expect(viviendasDemo(12)).toEqual(viv);
    viv.forEach(v => { expect(v.lat).toBeGreaterThan(5.67); expect(v.lat).toBeLessThan(5.72); expect(v.lon).toBeGreaterThan(-76.68); expect(v.lon).toBeLessThan(-76.63); });
  });
  it('EDAN y RUD exportan solo conceptos firmados, con encabezado y BOM para Excel', () => {
    const evs = [...evaluacionesDemo(viv), ev0()];
    const edan = csvEDAN(evs), rud = csvRUD(evs);
    expect(edan.startsWith('﻿ID evaluación;')).toBe(true);
    expect(edan.trim().split('\r\n')).toHaveLength(1 + evs.filter(e => e.estado === 'firmada').length);
    expect(rud).toMatch(/Autorreconocimiento étnico/);
    expect(rud).toMatch(/Negro \/ afrocolombiano/);
  });
  it('un texto con punto y coma o comillas no rompe el CSV', () => {
    const e = evaluacionesDemo(viv)[0]; e.decision.restricciones = 'No ocupar; "zona 2"';
    expect(csvEDAN([e])).toContain('"No ocupar; ""zona 2"""');
  });
});
