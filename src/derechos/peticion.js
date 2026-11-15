/* ==========================================================================
   AXIONA EVALÚA · Derecho de petición (plantilla, sin IA)
   --------------------------------------------------------------------------
   Arma el texto con los datos del predio y del hogar. El ciudadano lo revisa
   y lo edita antes de enviarlo: la app nunca lo radica sola.
   ========================================================================== */
import { textoFecha, hoyColombia, sumarHabiles } from '../nucleo/calendario.js';

export const PETICIONES = {
  evaluacion: 'Que se realice la evaluación técnica de mi vivienda por un profesional habilitado (Circular UNGRD 73 de 2026) y se me entregue copia del concepto.',
  rud: 'Que se verifique mi inclusión en el Registro Único de Damnificados (RUD) del sismo del 10 de agosto de 2026 y, si no estoy inscrito o mis datos tienen errores, se corrija o se me indique el procedimiento.',
  apoyo: 'Que se me informe el estado de mi solicitud de apoyo económico temporal de arriendo, el valor oficial y la fecha de pago.',
  concepto: 'Que se me entregue copia del concepto técnico y del cartel asignado a mi vivienda.',
  ayudas: 'Que se me informe qué ayudas, subsidios o programas de reparación y reconstrucción aplican a mi caso y cómo acceder a ellos.',
};

/**
 * @param {object} d { ciudad, entidad, nombre, documento, telefono, correo, direccion, barrio, peticiones[], hechosExtra, anexos[] }
 * @param {object} pr predio (para los hechos)
 */
export function redactarPeticion(d, pr = {}) {
  const hoy = hoyColombia();
  const hechos = [
    `El 10 de agosto de 2026 ocurrió el sismo con epicentro en San José del Palmar (Chocó), que afectó mi vivienda ubicada en ${d.direccion || '[dirección]'}${d.barrio ? `, barrio ${d.barrio}` : ''}, en ${d.ciudad}.`,
  ];
  const daño = [];
  const s = pr.senales || {};
  if (s.colapso) daño.push('colapso parcial');
  if (s.inclinacion) daño.push('inclinación visible');
  if (s.columnas) daño.push('daño en columnas o vigas');
  if (s.terreno) daño.push('hundimiento o falla del terreno');
  if (s.grietasGrandes) daño.push('grietas grandes en muros');
  if (daño.length) hechos.push(`La vivienda presenta: ${daño.join(', ')}.`);
  const gr = (pr.grietas || []).filter(g => g.ultima);
  if (gr.length) hechos.push(`Medí ${gr.length} grieta(s) con la tarjeta-regla de AXIONA EVALÚA; la más ancha mide ${Math.max(...gr.map(g => g.ultima.anchoMm)).toString().replace('.', ',')} mm (medición de apoyo, no reemplaza la evaluación profesional).`);
  if (pr.hogar?.personas) hechos.push(`En el hogar viven ${pr.hogar.personas} personas${+pr.hogar.menores ? `, ${pr.hogar.menores} menores de edad` : ''}${+pr.hogar.mayores ? `, ${pr.hogar.mayores} adultos mayores` : ''}${+pr.hogar.discapacidad ? `, ${pr.hogar.discapacidad} con discapacidad` : ''}.`);
  if (d.hechosExtra) hechos.push(d.hechosExtra);
  const pets = (d.peticiones || ['evaluacion']).map(k => PETICIONES[k]).filter(Boolean);
  const vence = sumarHabiles(hoy, 15);
  return `${d.ciudad}, ${textoFecha(hoy, false)}

Señores
${d.entidad || `Alcaldía de ${d.ciudad}`}
E. S. D.

Referencia: Derecho de petición (artículo 23 de la Constitución Política y Ley 1755 de 2015)

Yo, ${d.nombre || '[nombre completo]'}, identificado(a) con cédula de ciudadanía n.º ${d.documento || '[número]'}, respetuosamente presento el siguiente derecho de petición.

HECHOS
${hechos.map((h, i) => `${i + 1}. ${h}`).join('\n')}

PETICIONES
${pets.map((p, i) => `${i + 1}. ${p}`).join('\n')}

FUNDAMENTOS
Artículo 23 de la Constitución Política; Ley 1755 de 2015, artículo 14 (término de 15 días hábiles para resolver); Decreto 1171 de 2026 (situación de desastre nacional); Circular UNGRD 73 de 2026.

ANEXOS
${(d.anexos?.length ? d.anexos : ['Expediente de la vivienda generado con AXIONA EVALÚA (fotos, ubicación y mediciones).']).map(a => `- ${a}`).join('\n')}

NOTIFICACIONES
Recibo notificaciones en ${d.direccion || '[dirección]'}${d.telefono ? `, teléfono ${d.telefono}` : ''}${d.correo ? `, correo ${d.correo}` : ''}.

Atentamente,

${d.nombre || '[nombre]'}
C. C. ${d.documento || '[número]'}

(Si la radica hoy, la respuesta debe llegar a más tardar el ${textoFecha(vence, false)}: 15 días hábiles.)`;
}
