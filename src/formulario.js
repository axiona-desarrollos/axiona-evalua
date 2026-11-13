/* ==========================================================================
   AXIONA EVALÚA · Formulario de inspección
   --------------------------------------------------------------------------
   Fase 1 (inspección visual rápida) según la Circular Conjunta 73 de 2026
   (UNGRD–IDIGER): carteles verde, amarillo y rojo, remisión a fase 2 y perfil
   del evaluador. Los campos siguen la estructura de las inspecciones post-sismo
   tipo ATC-20 adaptadas a Colombia. Es CONFIGURABLE: cuando la Alcaldía entregue
   los instrumentos oficiales, se ajustan aquí sin tocar el resto de la app.
   ========================================================================== */

export const CARTELES = {
  verde: { nombre: 'Verde · Inspeccionada', corto: 'Verde', color: '#2fbf71', texto: 'Ingreso y usos permitidos. No se observan condiciones severas ni daño estructural aparente que comprometa la seguridad.' },
  amarillo: { nombre: 'Amarillo · Uso restringido', corto: 'Amarillo', color: '#f2b233', texto: 'Ocupación parcial o condicionada. Se instala cinta de aislamiento donde aplique. Requiere fase 2.' },
  rojo: { nombre: 'Rojo · Inseguro', corto: 'Rojo', color: '#ef4b4b', texto: 'Ingreso prohibido salvo autorización escrita de la autoridad competente. Requiere fase 2. No es una orden de demolición.' },
};

export const NIVELES = ['ninguno', 'leve', 'moderado', 'severo'];
export const NIVEL_TXT = { ninguno: 'Ninguno', leve: 'Leve', moderado: 'Moderado', severo: 'Severo' };

export const SISTEMAS = [
  ['porticos', 'Pórticos de concreto'], ['confinada', 'Mampostería confinada'], ['noReforzada', 'Mampostería no reforzada'],
  ['madera', 'Madera'], ['palafito', 'Palafito / madera sobre pilotes'], ['bahareque', 'Bahareque'], ['mixto', 'Mixto / otro'],
];
export const USOS = [['residencial', 'Residencial'], ['mixto', 'Mixto (vivienda y comercio)'], ['comercial', 'Comercial'], ['institucional', 'Institucional']];
export const ETNIAS = [['afro', 'Negro / afrocolombiano'], ['indigena', 'Indígena'], ['raizal', 'Raizal'], ['palenquero', 'Palenquero'], ['ninguno', 'Ninguno'], ['nr', 'No responde']];
export const TENENCIAS = [['propia', 'Propia'], ['arriendo', 'Arriendo'], ['familiar', 'Familiar'], ['poseedor', 'Poseedor'], ['otra', 'Otra']];

/** Condiciones observadas: cada una con su peso en la clasificación de respaldo. */
export const CONDICIONES = [
  { id: 'colapso', t: 'Colapso total o parcial', ayuda: 'Pisos caídos, edificación fuera de sus apoyos o colapso de una parte.', critica: true },
  { id: 'inclinacion', t: 'Inclinación o desplome de la edificación o de un piso', ayuda: 'Se nota a simple vista o con plomada.', critica: true },
  { id: 'estructural', t: 'Daño en columnas, vigas o nudos', ayuda: 'Concreto desprendido, acero expuesto o pandeado, fisuras en X.', critica: true },
  { id: 'muros', t: 'Grietas en muros portantes', ayuda: 'Grietas diagonales o en X, muros desplazados o abombados.' },
  { id: 'cubierta', t: 'Daño en cubierta o entrepisos', ayuda: 'Cubierta desplazada, entrepisos fisurados o con flecha.' },
  { id: 'caida', t: 'Elementos que pueden caer', ayuda: 'Fachadas, parapetos, balcones, tanques, tejas sueltas.' },
  { id: 'terreno', t: 'Falla del terreno o asentamiento', ayuda: 'Hundimientos, grietas en el suelo, deslizamiento, socavación.', critica: true },
  { id: 'vecina', t: 'Riesgo por edificación vecina', ayuda: 'Una construcción vecina puede caer sobre esta.' },
];

export const FOTOS_GUIADAS = [
  { id: 'fachada', t: 'Fachada principal', ayuda: 'Toda la fachada, de frente, con la placa o número si existe.' },
  { id: 'lateral', t: 'Fachada lateral o posterior', ayuda: 'Muestra si la edificación está desplomada.' },
  { id: 'danio', t: 'Daño principal', ayuda: 'De cerca, con algo de referencia de tamaño (una mano, un lapicero).' },
  { id: 'estructura', t: 'Columnas, vigas o muros portantes', ayuda: 'Los elementos que sostienen la casa.' },
  { id: 'cubierta', t: 'Cubierta o entrepiso', ayuda: 'Desde adentro si es seguro entrar.' },
  { id: 'extra', t: 'Foto adicional', ayuda: 'Terreno, vecina, interior u otro hallazgo.' },
];

/** Evaluación vacía para una edificación. */
export function nuevaEvaluacion(vivienda, evaluador) {
  const ahora = new Date().toISOString();
  return {
    id: `EV-${vivienda.id}-${Date.now().toString(36).toUpperCase()}`,
    viviendaId: vivienda.id, fase: 1, estado: 'borrador', creada: ahora, actualizada: ahora,
    ubicacion: { lat: vivienda.lat, lon: vivienda.lon, precision: null, gps: false },
    edificacion: { direccion: vivienda.direccion, barrio: vivienda.barrio, uso: 'residencial', sistema: '', pisos: 1, sotano: false, hogares: 1, anio: '' },
    condiciones: Object.fromEntries(CONDICIONES.map(c => [c.id, 'ninguno'])),
    observaciones: '',
    hogar: { jefe: vivienda.propietario || '', documento: '', telefono: '', personas: '', menores: '', mayores: '', discapacidad: '', etnia: '', zona: vivienda.zona || 'urbana', tenencia: '', consentimiento: false },
    fotos: {},
    agente: null,
    decision: { cartel: '', restricciones: '', fase2: false, apuntalar: false, evacuar: false, justificacion: '' },
    evaluador: { ...evaluador },
    firma: null, firmada: null,
    revision: { estado: 'pendiente', nota: '', por: '', fecha: null },
    version: 1, sincronizada: false,
  };
}

/** Lo que falta para poder firmar. Devuelve una lista legible. */
export function faltantes(ev) {
  const f = [];
  if (!ev.edificacion.sistema) f.push('Sistema estructural');
  if (!ev.ubicacion.gps) f.push('Ubicación GPS tomada en sitio');
  if (!ev.fotos.fachada) f.push('Foto de la fachada principal');
  const hayDanio = Object.values(ev.condiciones).some(v => v !== 'ninguno');
  if (hayDanio && !ev.fotos.danio) f.push('Foto del daño principal');
  if (!ev.hogar.consentimiento) f.push('Consentimiento de tratamiento de datos (Ley 1581)');
  if (!ev.hogar.jefe) f.push('Nombre del jefe de hogar');
  if (!ev.decision.cartel) f.push('Cartel asignado por el evaluador');
  if (ev.decision.cartel && ev.decision.cartel !== 'verde' && !ev.decision.restricciones) f.push('Restricciones de uso');
  if (!ev.evaluador?.matricula) f.push('Matrícula profesional del evaluador');
  return f;
}

export const puedeFirmar = ev => faltantes(ev).length === 0;
