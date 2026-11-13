/* ==========================================================================
   AXIONA EVALÚA · Datos de demostración
   --------------------------------------------------------------------------
   Listado ficticio de edificaciones pendientes en barrios de Quibdó, para
   mostrar la plataforma. NO son datos reales: direcciones, nombres y
   ubicaciones son ilustrativos. En operación, el listado lo carga la Alcaldía.
   ========================================================================== */

export const CENTRO = { lat: 5.6947, lon: -76.6582 };

export const BARRIOS = [
  { n: 'El Futuro', lat: 5.7008, lon: -76.6468 }, { n: 'Kennedy', lat: 5.6889, lon: -76.6532 },
  { n: 'Medrano', lat: 5.6962, lon: -76.6489 }, { n: 'La Yesquita', lat: 5.6921, lon: -76.6610 },
  { n: 'Niño Jesús', lat: 5.6851, lon: -76.6487 }, { n: 'Cristo Rey', lat: 5.6990, lon: -76.6553 },
  { n: 'Pandeyuca', lat: 5.6829, lon: -76.6561 }, { n: 'Tomás Pérez', lat: 5.7036, lon: -76.6517 },
];

const NOMBRES = ['María', 'José', 'Luz Dary', 'Yeison', 'Rosa', 'Wilmer', 'Dora', 'Jhon Jairo', 'Ana Lucía', 'Fredy', 'Yuli', 'Esneider', 'Carmen', 'Arley', 'Nelly', 'Robinson'];
const APELLIDOS = ['Mosquera', 'Palacios', 'Córdoba', 'Rentería', 'Murillo', 'Asprilla', 'Valencia', 'Perea', 'Hinestroza', 'Mena', 'Lloreda', 'Cuesta', 'Moreno', 'Ibargüen'];

/** Generador determinístico para que la demostración sea siempre la misma. */
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export function viviendasDemo(n = 60) {
  const r = rng(73);
  const out = [];
  for (let i = 0; i < n; i++) {
    const b = BARRIOS[i % BARRIOS.length];
    const cra = 1 + Math.floor(r() * 12), calle = 18 + Math.floor(r() * 20), num = 10 + Math.floor(r() * 80);
    out.push({
      id: `Q-${String(i + 1).padStart(4, '0')}`,
      barrio: b.n,
      direccion: `${r() < 0.5 ? 'Carrera' : 'Calle'} ${r() < 0.5 ? cra : calle} # ${calle}-${num}`,
      lat: +(b.lat + (r() - 0.5) * 0.0045).toFixed(6), lon: +(b.lon + (r() - 0.5) * 0.0045).toFixed(6),
      propietario: `${NOMBRES[Math.floor(r() * NOMBRES.length)]} ${APELLIDOS[Math.floor(r() * APELLIDOS.length)]}`,
      prioridad: r() < 0.25 ? 'alta' : r() < 0.6 ? 'media' : 'normal',
      zona: 'urbana',
      reporte: r() < 0.5 ? 'Reporte ciudadano' : 'Recorrido de Bomberos',
    });
  }
  return out;
}

/** Algunas ya evaluadas, para que el tablero de la demostración tenga avance. */
export function evaluacionesDemo(viviendas) {
  const r = rng(2026);
  const carteles = ['verde', 'amarillo', 'rojo'];
  const sistemas = ['porticos', 'confinada', 'noReforzada', 'madera', 'palafito'];
  return viviendas.filter((_, i) => i % 3 === 0).map((v, k) => {
    const cartel = carteles[Math.floor(r() * 3)];
    const fecha = new Date(Date.UTC(2026, 10, 3 + (k % 9), 14 + (k % 5), 10)).toISOString();
    return {
      id: `EV-${v.id}-DEMO`, viviendaId: v.id, fase: 1, estado: 'firmada', demo: true, creada: fecha, actualizada: fecha, firmada: fecha,
      ubicacion: { lat: v.lat, lon: v.lon, gps: true, precision: 6 },
      edificacion: { direccion: v.direccion, barrio: v.barrio, uso: 'residencial', sistema: sistemas[Math.floor(r() * sistemas.length)], pisos: 1 + Math.floor(r() * 3), sotano: false, hogares: 1 + Math.floor(r() * 2), anio: '' },
      condiciones: {}, observaciones: 'Evaluación de demostración.',
      hogar: { jefe: v.propietario, documento: '', telefono: '', personas: 2 + Math.floor(r() * 5), menores: Math.floor(r() * 3), mayores: Math.floor(r() * 2), discapacidad: 0, etnia: r() < 0.85 ? 'afro' : 'ninguno', zona: 'urbana', tenencia: r() < 0.6 ? 'propia' : 'arriendo', consentimiento: true },
      fotos: {}, agente: null,
      decision: { cartel, restricciones: cartel === 'verde' ? '' : 'Uso restringido según inspección.', fase2: cartel !== 'verde', apuntalar: cartel === 'rojo', evacuar: cartel === 'rojo', justificacion: '' },
      evaluador: { nombre: k % 2 ? 'Ing. Carolina Rentería' : 'Ing. Andrés Palacios', profesion: 'Ingeniero civil', matricula: k % 2 ? 'CHO-20456' : 'ANT-18832', rupe: k % 2 ? 'RUPE-0411' : 'RUPE-0390', perfil: 'P1' },
      firma: null, revision: { estado: k % 4 === 0 ? 'pendiente' : 'aprobada', nota: '', por: 'Coordinación', fecha },
      version: 1, sincronizada: true,
    };
  });
}
