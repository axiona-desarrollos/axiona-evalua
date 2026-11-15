/* ==========================================================================
   AXIONA EVALÚA · El expediente por predio
   --------------------------------------------------------------------------
   Un predio (una vivienda o edificación) es la unidad que une todo:
   reporte del ciudadano → priorización → evaluación del RUPE → levantamiento
   (Topo) → diseño y presupuesto (Obra) → derechos y documentos.
   Todo se guarda primero en el teléfono (IndexedDB) y se sincroniza.
   ========================================================================== */
import { CIUDADES } from './ciudades.js';

export const ESTADOS = {
  borrador: 'Borrador', reportado: 'Reportado', en_cola: 'En cola de evaluación', asignado: 'Asignado a evaluador',
  evaluado: 'Evaluado', en_diseno: 'Diseño y presupuesto', expediente: 'Expediente listo', cerrado: 'Cerrado',
};
export const FLUJO = ['reportado', 'en_cola', 'asignado', 'evaluado', 'en_diseno', 'expediente'];

const ahora = () => new Date().toISOString();

/** Código legible: Q-26-4F7K2 (ciudad, año, aleatorio sin letras confusas). */
export function nuevoId(ciudad, rnd = Math.random) {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(rnd() * A.length)];
  return `${CIUDADES[ciudad]?.prefijo || 'X'}-26-${s}`;
}

export function nuevoPredio(ciudad, origen = 'ciudadano') {
  const t = ahora();
  return {
    id: nuevoId(ciudad), ciudad, origen, estado: 'borrador', creado: t, actualizado: t, version: 1, sincronizado: false,
    ubicacion: { lat: null, lon: null, precision: null, gps: false, direccion: '', barrio: '', referencia: '', numeroPredial: '' },
    contacto: { nombre: '', telefono: '', documento: '', correo: '', consentimiento: false, canal: 'whatsapp' },
    hogar: { personas: '', menores: '', mayores: '', discapacidad: '', gestantes: '', tenencia: '', etnia: '' },
    vivienda: { sistema: '', pisos: 1, uso: 'residencial', ph: false, anio: '', alturaM: '' },
    senales: {}, fotos: [], grietas: [], inclinaciones: [],
    sismo: null, orientacion: null, evaluacionId: null, evaluacionResumen: null,
    topo: null, obra: null, derechos: null, documentos: [],
    historial: [{ fecha: t, evento: 'Creado', por: origen }],
  };
}

export function anotar(pr, evento, por = '') {
  pr.historial = [...(pr.historial || []), { fecha: ahora(), evento, por }];
  pr.actualizado = ahora();
  pr.version = (pr.version || 0) + 1;
  pr.sincronizado = false;
  return pr;
}

/** Lo que falta para enviar la solicitud de evaluación. */
export function faltantesSolicitud(pr) {
  const f = [];
  if (pr.ubicacion.lat === null) f.push('Ubicación de la vivienda');
  if (!pr.ubicacion.direccion) f.push('Dirección o referencia');
  if (!pr.fotos.some(x => x.tipo === 'fachada')) f.push('Foto de la fachada');
  if (!pr.contacto.nombre) f.push('Nombre de quien reporta');
  if (!pr.contacto.telefono) f.push('Teléfono o WhatsApp');
  if (!pr.contacto.consentimiento) f.push('Autorización de tratamiento de datos (Ley 1581)');
  return f;
}

/** Adaptador para el formulario de evaluación (fase 1). */
export const viviendaDePredio = pr => ({ id: pr.id, lat: pr.ubicacion.lat, lon: pr.ubicacion.lon, direccion: pr.ubicacion.direccion, barrio: pr.ubicacion.barrio, propietario: pr.contacto.nombre, zona: 'urbana' });

/** Resumen sin fotos ni datos sensibles, para el índice del servidor y la cola. */
export function resumen(pr) {
  return {
    id: pr.id, ciudad: pr.ciudad, origen: pr.origen, estado: pr.estado, creado: pr.creado, actualizado: pr.actualizado, version: pr.version,
    ubicacion: { lat: pr.ubicacion.lat, lon: pr.ubicacion.lon, barrio: pr.ubicacion.barrio, direccion: pr.ubicacion.direccion },
    vivienda: pr.vivienda, senales: pr.senales, hogar: { personas: pr.hogar.personas, menores: pr.hogar.menores, mayores: pr.hogar.mayores, discapacidad: pr.hogar.discapacidad, gestantes: pr.hogar.gestantes },
    grietas: (pr.grietas || []).map(g => ({ id: g.id, elemento: g.elemento, patron: g.patron, ultima: g.ultima && { anchoMm: g.ultima.anchoMm, categoria: g.ultima.categoria } })),
    inclinaciones: (pr.inclinaciones || []).map(i => ({ deriva: i.deriva, razonLimite: i.razonLimite })),
    sismo: pr.sismo, orientacion: pr.orientacion && { nivel: pr.orientacion.nivel }, evaluacionResumen: pr.evaluacionResumen, nFotos: pr.fotos?.length || 0,
    demo: !!pr.demo,
  };
}

/* ------------------------- datos de demostración ------------------------- */
const NOMBRES = ['María', 'José', 'Luz Dary', 'Yeison', 'Rosa', 'Wilmer', 'Dora', 'Jhon Jairo', 'Ana Lucía', 'Fredy', 'Yuli', 'Esneider', 'Carmen', 'Arley', 'Nelly', 'Robinson'];
const APELLIDOS = { quibdo: ['Mosquera', 'Palacios', 'Córdoba', 'Rentería', 'Murillo', 'Asprilla', 'Valencia', 'Perea', 'Hinestroza', 'Mena'], pereira: ['Gómez', 'Ramírez', 'Osorio', 'Cardona', 'Montoya', 'Restrepo', 'Agudelo', 'Arango', 'Valencia', 'Giraldo'] };
const SISTEMAS = { quibdo: ['noReforzada', 'madera', 'palafito', 'confinada', 'porticos', 'bahareque'], pereira: ['confinada', 'porticos', 'noReforzada', 'bahareque', 'mixto'] };

export function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

/**
 * Solicitudes ficticias para mostrar la plataforma (marcadas demo: true).
 * Nombres, direcciones y ubicaciones son ilustrativos.
 */
export function prediosDemo(ciudad, n = 36, seed = ciudad === 'quibdo' ? 73 : 99) {
  const C = CIUDADES[ciudad], r = rng(seed), out = [];
  const claves = ['colapso', 'inclinacion', 'columnas', 'terreno', 'grietasGrandes', 'caida', 'pisos', 'puertas'];
  for (let i = 0; i < n; i++) {
    const [barrio, la, lo] = C.barriosDemo[i % C.barriosDemo.length];
    const dias = Math.floor(r() * 40);
    const creado = new Date(Date.UTC(2026, 9, 5 + dias, 13, Math.floor(r() * 60))).toISOString();
    const pr = nuevoPredio(ciudad, r() < 0.6 ? 'ciudadano' : 'brigada');
    pr.id = `${C.prefijo}-26-D${String(i + 1).padStart(3, '0')}`;
    pr.demo = true; pr.creado = creado; pr.actualizado = creado;
    pr.estado = r() < 0.55 ? 'en_cola' : r() < 0.5 ? 'asignado' : r() < 0.6 ? 'evaluado' : 'en_diseno';
    pr.ubicacion = { ...pr.ubicacion, lat: +(la + (r() - 0.5) * 0.006).toFixed(6), lon: +(lo + (r() - 0.5) * 0.006).toFixed(6), gps: true, precision: 6 + Math.floor(r() * 12), barrio, direccion: `${r() < 0.5 ? 'Carrera' : 'Calle'} ${1 + Math.floor(r() * 30)} # ${10 + Math.floor(r() * 60)}-${10 + Math.floor(r() * 80)}` };
    pr.contacto = { ...pr.contacto, nombre: `${NOMBRES[Math.floor(r() * NOMBRES.length)]} ${APELLIDOS[ciudad][Math.floor(r() * 10)]}`, telefono: '300 000 0000', consentimiento: true };
    pr.hogar = { personas: 2 + Math.floor(r() * 6), menores: Math.floor(r() * 3), mayores: Math.floor(r() * 2), discapacidad: r() < 0.12 ? 1 : 0, gestantes: r() < 0.06 ? 1 : 0, tenencia: r() < 0.6 ? 'propia' : 'arriendo', etnia: '' };
    pr.vivienda = { ...pr.vivienda, sistema: SISTEMAS[ciudad][Math.floor(r() * SISTEMAS[ciudad].length)], pisos: 1 + Math.floor(r() * (ciudad === 'pereira' ? 5 : 3)), ph: ciudad === 'pereira' && r() < 0.3 };
    for (const k of claves) if (r() < (['colapso', 'columnas', 'terreno'].includes(k) ? 0.035 : 0.22)) pr.senales[k] = true;
    if (r() < 0.45) {
      const ancho = +(0.2 + r() * r() * 9).toFixed(1);
      pr.grietas.push({ id: 'g1', elemento: r() < 0.25 ? 'columna' : r() < 0.6 ? 'muroPortante' : 'muroDivisorio', patron: r() < 0.5 ? 'diagonal' : 'vertical', ultima: { anchoMm: ancho, categoria: ancho <= 1 ? 1 : ancho <= 5 ? 2 : 3, fecha: creado } });
    }
    pr.historial = [{ fecha: creado, evento: pr.origen === 'brigada' ? 'Registrado por brigada' : 'Reportado por el ciudadano', por: pr.origen }];
    out.push(pr);
  }
  return out;
}
