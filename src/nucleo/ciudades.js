/* ==========================================================================
   AXIONA EVALÚA · Ciudades
   --------------------------------------------------------------------------
   Todo lo que cambia entre Quibdó y Pereira vive aquí: mapa, parámetros
   sísmicos de la NSR-10, entidades a las que se escala un caso y contexto.
   Lo que no está verificado en fuente primaria lleva verificado: false y la
   app lo muestra como «por verificar»; el profesional lo puede corregir en
   Ajustes sin tocar el código.
   ========================================================================== */

export const CIUDADES = {
  quibdo: {
    id: 'quibdo', nombre: 'Quibdó', departamento: 'Chocó', divipola: '27001',
    centro: { lat: 5.6947, lon: -76.6582 }, zoom: 13.6,
    caja: [-76.705, 5.635, -76.595, 5.755],            // recorte del mapa propio (PMTiles)
    mapa: 'mapa/quibdo.pmtiles',
    sismo: 'sismo/quibdo.json',
    nsr10: {
      Aa: 0.35, Av: 0.35, Ae: 0.25, Ad: 0.13, amenaza: 'Alta', verificado: true,
      fuente: 'NSR-10, Título A, Apéndice A-4 (municipio 27001)',
    },
    perfilSugerido: 'D',
    contexto: [
      'Suelos aluviales del río Atrato y sus afluentes: atención a la licuación, la socavación y los asentamientos.',
      'Predominan la mampostería no reforzada, la madera y los palafitos.',
      'Balance de la Alcaldía al 31-oct-2026: 908 viviendas pendientes de evaluación y 57 conceptos de demolición.',
    ],
    entidades: [
      { tipo: 'riesgo', n: 'Alcaldía de Quibdó · Oficina de Gestión del Riesgo de Desastres', nota: 'Solicitud de evaluación, RUD y ayudas', verificado: false },
      { tipo: 'personeria', n: 'Personería Municipal de Quibdó', nota: 'Derechos de petición, quejas y acompañamiento', verificado: false },
      { tipo: 'defensoria', n: 'Defensoría del Pueblo · Regional Chocó', nota: 'Vulneración de derechos y tutelas', verificado: false },
      { tipo: 'consultorio', n: 'Consultorio jurídico de la Universidad Tecnológica del Chocó (UTCH)', nota: 'Asesoría gratuita (Ley 2113 de 2021)', verificado: false },
      { tipo: 'licencias', n: 'Secretaría de Planeación / curaduría urbana de Quibdó', nota: 'Licencias de reforzamiento, demolición y reconstrucción', verificado: false },
    ],
    barriosDemo: [
      ['Medrano', 5.6962, -76.6489], ['Kennedy', 5.6889, -76.6532], ['El Futuro', 5.7008, -76.6468], ['La Yesquita', 5.6921, -76.6610],
      ['Niño Jesús', 5.6851, -76.6487], ['Cristo Rey', 5.6990, -76.6553], ['Pandeyuca', 5.6829, -76.6561], ['Tomás Pérez', 5.7036, -76.6517],
    ],
    prefijo: 'Q',
  },
  pereira: {
    id: 'pereira', nombre: 'Pereira', departamento: 'Risaralda', divipola: '66001',
    centro: { lat: 4.8133, lon: -75.6961 }, zoom: 13.2,
    caja: [-75.785, 4.755, -75.595, 4.885],             // incluye Dosquebradas
    mapa: 'mapa/pereira.pmtiles',
    sismo: 'sismo/pereira.json',
    nsr10: {
      Aa: 0.25, Av: 0.25, Ae: null, Ad: null, amenaza: 'Alta', verificado: false,
      fuente: 'NSR-10, Título A, Apéndice A-4 (municipio 66001) — por verificar; Pereira cuenta además con estudios de microzonificación sísmica',
    },
    perfilSugerido: 'D',
    contexto: [
      'Laderas y cañadas con rellenos antrópicos: atención a deslizamientos y a la amplificación en depósitos.',
      'Daño concentrado en edificios del Centro y comunas consolidadas: muchos casos son de propiedad horizontal.',
      'Antecedente: sismo del Eje Cafetero del 25-ene-1999 (Mw 6,1).',
    ],
    entidades: [
      { tipo: 'riesgo', n: 'Alcaldía de Pereira · Dirección de Gestión del Riesgo (DIGER)', nota: 'Solicitud de evaluación, RUD y ayudas', verificado: false },
      { tipo: 'personeria', n: 'Personería de Pereira', nota: 'Derechos de petición, quejas y veedurías inscritas', verificado: false },
      { tipo: 'defensoria', n: 'Defensoría del Pueblo · Regional Risaralda', nota: 'Vulneración de derechos y tutelas', verificado: false },
      { tipo: 'consultorio', n: 'Consultorios jurídicos de las universidades de Pereira (p. ej. Universidad Libre, Universidad Católica de Pereira)', nota: 'Asesoría gratuita (Ley 2113 de 2021)', verificado: false },
      { tipo: 'licencias', n: 'Curadurías urbanas de Pereira / Secretaría de Planeación', nota: 'Licencias de reforzamiento, demolición y reconstrucción', verificado: false },
    ],
    barriosDemo: [
      ['Centro', 4.8133, -75.6961], ['Cuba', 4.7935, -75.7275], ['Villa Santana', 4.8045, -75.6625], ['Kennedy', 4.8030, -75.7060],
      ['Boston', 4.8150, -75.6845], ['San Nicolás', 4.8075, -75.7105], ['Corocito', 4.8180, -75.6895], ['Álamos', 4.8085, -75.6815],
    ],
    prefijo: 'P',
  },
};

export const LISTA_CIUDADES = Object.values(CIUDADES);

/** Ciudad cuyo recuadro contiene el punto; si ninguno, la más cercana al centro. */
export function ciudadDe(p) {
  if (!p) return null;
  const dentro = LISTA_CIUDADES.find(c => p.lon >= c.caja[0] && p.lon <= c.caja[2] && p.lat >= c.caja[1] && p.lat <= c.caja[3]);
  if (dentro) return dentro;
  let mejor = null, dm = Infinity;
  for (const c of LISTA_CIUDADES) {
    const d = Math.hypot(p.lat - c.centro.lat, (p.lon - c.centro.lon) * Math.cos(p.lat * Math.PI / 180));
    if (d < dm) { dm = d; mejor = c; }
  }
  return dm < 0.5 ? mejor : null; // a más de ~55 km de ambas no se asume ninguna
}
