/* ==========================================================================
   AXIONA EVALÚA · Motor de derechos (determinista, sin IA)
   --------------------------------------------------------------------------
   Con las respuestas del ciudadano a unas pocas preguntas, arma la lista de
   derechos que le aplican, cada uno con su ficha del corpus, su plazo
   calculado en días calendario o hábiles (nucleo/calendario.js) y lo que
   puede hacer. Las fechas que dependen de la publicación oficial son
   ajustes editables (FECHAS). La IA solo responde preguntas abiertas, y
   siempre con citas a estas mismas fichas.
   ========================================================================== */
import { deISO, sumarMeses, sumarDias, sumarHabiles, habilesEntre, textoFecha, hoyColombia, aISO } from '../nucleo/calendario.js';

/** Fechas base (editables en Ajustes). Las «aprox.» dependen del Diario Oficial. */
export const FECHAS = {
  sismo: '2026-08-10',
  desastreDesde: '2026-08-11',                 // Decreto 1171: 12 meses, prorrogables
  publicacion1423: '2026-09-17',               // por confirmar: rige desde el día siguiente
  expedicion1422: '2026-09-17',
  cierreRUD: '2026-09-04',
};

/** Vigencias calculadas. */
export function vigencias(f = FECHAS) {
  const inicio1423 = sumarDias(deISO(f.publicacion1423), 1);
  return {
    desastreHasta: sumarDias(sumarMeses(deISO(f.desastreDesde), 12), -1),
    arriendoDesde: inicio1423,
    arriendoHasta: sumarDias(sumarMeses(inicio1423, 6), -1),
    phHasta: sumarDias(sumarMeses(inicio1423, 24), -1),
    reusoHasta: sumarDias(sumarMeses(deISO(f.expedicion1422), 24), -1),
    potHasta: sumarDias(sumarMeses(deISO(f.expedicion1422), 48), -1),
    cierreRUD: deISO(f.cierreRUD),
  };
}

/** Tope del canon (Decreto 1423, art. 8): último canon × (1 + IPC). */
export function topeCanon(ultimoCanon, ipcPorc) {
  if (!(ultimoCanon > 0) || !(ipcPorc >= 0)) return null;
  return Math.round(ultimoCanon * (1 + ipcPorc / 100));
}

/** Tope de la Ley 820, art. 18: 1 % del valor comercial. */
export const topeLey820 = valorComercial => (valorComercial > 0 ? Math.round(valorComercial * 0.01) : null);

/** Prórroga del art. 5: contratos que vencen entre el 10-ago y el 31-dic-2026 → +6 meses. */
export function prorrogaContrato(venceISO) {
  if (!venceISO) return null;
  const v = deISO(venceISO);
  if (v < deISO('2026-08-10') || v > deISO('2026-12-31')) return { aplica: false };
  return { aplica: true, nuevaFecha: sumarMeses(v, 6) };
}

/** Respuesta a un derecho de petición: 15 días hábiles (10 si pide documentos, 30 si es consulta). */
export function plazoPeticion(radicadoISO, tipo = 'general') {
  const n = tipo === 'documentos' ? 10 : tipo === 'consulta' ? 30 : 15;
  const r = deISO(radicadoISO);
  return { dias: n, vence: sumarHabiles(r, n) };
}

const dineroCOP = v => (v === null || v === undefined ? '' : '$ ' + Math.round(v).toLocaleString('es-CO'));

/**
 * @param {object} s  situación: { rol, estado, enRUD, desalojo, contratoVence, ultimoCanon, ipc, valorComercial, vulnerables, negaronAyuda, necesitaLicencia, ph }
 * @param {object} op { hoy, fechas }
 */
export function analizar(s, { hoy = hoyColombia(), fechas = FECHAS } = {}) {
  const V = vigencias(fechas), out = [], esc = [];
  const vigente = hasta => hoy <= hasta;
  const quedan = hasta => Math.max(0, habilesEntre(hoy, hasta));
  const pon = (d) => out.push(d);

  // 1. Evaluación de la vivienda (siempre)
  pon({
    id: 'evaluacion', titulo: 'Que un profesional evalúe su casa', prioridad: 1, citas: ['circ73'],
    texto: 'Puede pedir la evaluación de su vivienda. La hace un profesional inscrito en el RUPE en dos fases; el cartel verde no significa que no haya daños y el rojo no es por sí solo una orden de demolición.',
    acciones: ['Envíe su solicitud de evaluación desde esta app con sus fotos y mediciones.', 'Si en 15 días hábiles no le responden, presente un derecho de petición (la app lo redacta).'],
  });

  // 2. RUD
  if (s.enRUD !== 'si') {
    pon({
      id: 'rud', titulo: 'Registro Único de Damnificados (RUD)', prioridad: 1, citas: ['rud-cierre', 'cp-23', 'l1755-14', 'cp-86'],
      texto: `El RUD cerró el ${textoFecha(V.cierreRUD, false)}. ${s.enRUD === 'nose' ? 'Primero consulte si quedó inscrito.' : 'Si usted fue damnificado y no quedó inscrito o sus datos están mal,'} puede pedir la corrección o la revisión por derecho de petición ante la alcaldía o la UNGRD. Le deben responder en 15 días hábiles. Si la negativa afecta su mínimo vital o su vivienda digna, puede presentar una tutela sin abogado.`,
      acciones: ['Redacte el derecho de petición en la app (pestaña «Petición»).', 'Guarde la constancia de radicado: con ella se cuentan los 15 días hábiles.'],
      plazo: { texto: 'Inscripción cerrada desde el 4 de septiembre de 2026', vencido: true },
    });
  }

  // 3. Apoyo de arriendo
  if (['destruida', 'no_habitable'].includes(s.estado)) {
    pon({
      id: 'apoyo', titulo: 'Apoyo económico temporal para arriendo', prioridad: 2, citas: ['arriendo-ungrd'],
      texto: s.enRUD === 'si'
        ? 'Usted podría cumplir los requisitos: jefe de hogar en el RUD, residente en el municipio al momento del sismo y vivienda destruida o no habitable. Pregunte por el pago en la alcaldía. Las cifras del monto que circulan no coinciden: el valor oficial es el de la resolución de la UNGRD.'
        : 'El apoyo exige estar en el RUD. Resuelva primero lo del registro (punto anterior).',
      acciones: ['Pida por escrito el estado de su apoyo y el valor oficial.'],
    });
  }

  // 4. Arrendatario
  if (s.rol === 'arrendatario') {
    const vig = vigente(V.arriendoHasta);
    pon({
      id: 'desalojo', titulo: 'No lo pueden desalojar (con excepciones)', prioridad: s.desalojo ? 0 : 1, citas: ['d1423-2', 'd1423-3', 'd1423-6', 'd1423-13'],
      texto: vig
        ? `Hasta el ${textoFecha(V.arriendoHasta, false)} (aprox.) están suspendidos los desalojos de vivienda en los municipios afectados, si usted acredita afectación directa. Excepciones: evacuación por riesgo técnico o que el propietario necesite el inmueble para vivir él o su familia, con preaviso de 30 días calendario. La deuda de arriendo no se borra.`
        : `La suspensión de desalojos del Decreto 1423 terminó hacia el ${textoFecha(V.arriendoHasta, false)}. Si hay un proceso en curso, busque asesoría gratuita.`,
      plazo: { fecha: aISO(V.arriendoHasta), texto: vig ? `Quedan ${quedan(V.arriendoHasta)} días hábiles (aprox.)` : 'Vencido', vencido: !vig },
      acciones: s.desalojo ? ['Muestre al arrendador o a la autoridad el Decreto 1423 de 2026, art. 3.', 'Busque HOY el consultorio jurídico o la Personería.'] : [],
    });
    pon({ id: 'reajuste', titulo: 'El aumento anual del arriendo se aplaza', prioridad: 2, citas: ['d1423-4', 'd1423-7'],
      texto: 'El reajuste anual del canon se difiere seis meses y luego se paga en cuotas iguales, sin intereses de mora. Si no hay acuerdo de pago y usted declara vulnerabilidad, lo diferido se paga en seis cuotas.', acciones: [] });
    const pr = prorrogaContrato(s.contratoVence);
    if (pr?.aplica) pon({ id: 'prorroga', titulo: 'Puede prorrogar su contrato 6 meses', prioridad: 1, citas: ['d1423-5'],
      texto: `Su contrato vence el ${textoFecha(deISO(s.contratoVence), false)}, dentro del periodo cubierto. Si usted lo decide, se prorroga hasta el ${textoFecha(pr.nuevaFecha, false)}.`,
      plazo: { fecha: aISO(pr.nuevaFecha), texto: `Hasta el ${textoFecha(pr.nuevaFecha, false)}` }, acciones: ['Avísele por escrito al arrendador que hace uso de la prórroga (guarde copia).'] });
    const tope = topeCanon(s.ultimoCanon, s.ipc);
    if (tope) pon({ id: 'tope', titulo: 'Tope al valor del arriendo', prioridad: 2, citas: ['d1423-8', 'l820-18', 'l820-20'],
      texto: `Con un último canon de ${dineroCOP(s.ultimoCanon)} y un IPC de ${String(s.ipc).replace('.', ',')} %, el canon máximo durante la medida es ${dineroCOP(tope)} (último canon × (1 + IPC)). Si no hubo contrato previo, el tope es el 1 % del valor comercial${s.valorComercial ? `: ${dineroCOP(topeLey820(s.valorComercial))}` : ''}.`,
      calculo: { formula: 'canon máximo = último canon × (1 + IPC/100)', ultimoCanon: s.ultimoCanon, ipc: s.ipc, tope }, acciones: [] });
  }

  // 5. Arrendador
  if (s.rol === 'arrendador') pon({ id: 'arrendador', titulo: 'Sus obligaciones y excepciones como arrendador', prioridad: 2, citas: ['d1423-3', 'd1423-4', 'd1423-5', 'd1423-6', 'd1423-8', 'd1423-9'],
    texto: `Mientras rijan las medidas (hasta el ${textoFecha(V.arriendoHasta, false)}, aprox.) no puede ejecutar desalojos de arrendatarios afectados, salvo riesgo técnico o necesidad suya o de su familia con preaviso de 30 días. El reajuste se difiere, el contrato que vence entre el 10-ago y el 31-dic-2026 se puede prorrogar a voluntad del arrendatario, y el canon tiene tope (último canon + IPC). Los avisos de arriendo deben declarar que cumplen estas medidas.`, acciones: [] });

  // 6. Propiedad horizontal
  if (s.ph || s.rol === 'ph') {
    pon({ id: 'ph', titulo: 'Su edificio o conjunto (propiedad horizontal)', prioridad: 2, citas: ['d1423-10', 'd1448-ph'],
      texto: `Hasta el ${textoFecha(V.phHasta, false)} (aprox.) la copropiedad puede usar el fondo de imprevistos, ofrecer planes de pago y hacer asambleas virtuales o mixtas. Para reforzar la estructura, la licencia la pide el representante legal sin acta de asamblea, declarando la afectación por el sismo.`,
      plazo: { fecha: aISO(V.phHasta), texto: `Hasta el ${textoFecha(V.phHasta, false)} (aprox.)` }, acciones: ['Pida a la administración el concepto técnico del edificio y el plan de reforzamiento.'] });
  }

  // 7. Reparar, reforzar, demoler o reconstruir
  if (s.necesitaLicencia || ['propietario', 'ph', 'poseedor'].includes(s.rol)) {
    pon({ id: 'licencias', titulo: 'Licencias para reparar, reforzar, demoler o reconstruir', prioridad: 2, citas: ['d1448-lic', 'd1422-rec', 'd1422-curadurias'],
      texto: 'Hay reglas especiales para las licencias de demolición y reconstrucción de edificaciones afectadas, y las licencias vigentes se prorrogaron 12 meses en los departamentos afectados. Las edificaciones afectadas se pueden reconocer sin importar cuándo se terminaron. Las curadurías pueden suspender términos hasta 50 días hábiles.',
      acciones: ['Con su expediente de esta app (evaluación, levantamiento, planos y presupuesto) un profesional puede radicar la licencia.'] });
    pon({ id: 'reuso', titulo: 'Subsidio también para vivienda usada', prioridad: 3, citas: ['d1422-reuso'],
      texto: `Hasta el ${textoFecha(V.reusoHasta, false)} (aprox.) las viviendas usadas pueden acceder a los subsidios y la financiación de vivienda nueva.`, acciones: [] });
  }
  if (s.rol === 'poseedor') pon({ id: 'titulacion', titulo: 'Si no tiene escrituras', prioridad: 1, citas: ['d1422-rec'],
    texto: 'El Decreto 1422 prevé la legalización de asentamientos informales afectados y el saneamiento de la titulación. Un conflicto de propiedad necesita asesoría jurídica: el consultorio jurídico lo atiende gratis.', acciones: ['Reúna recibos de servicios, declaraciones de vecinos y pagos de impuesto predial.'] });

  // Escalamiento
  if (s.desalojo) esc.push('Hay un desalojo en curso.');
  if (s.negaronAyuda) esc.push('Le negaron una ayuda o un subsidio.');
  if (s.vulnerables) esc.push('En el hogar hay niños, personas mayores, personas con discapacidad o gestantes.');
  if (s.rol === 'poseedor') esc.push('Hay un tema de propiedad o titulación.');
  for (const d of out) if (d.plazo?.fecha && !d.plazo.vencido && habilesEntre(hoy, deISO(d.plazo.fecha)) <= 5) esc.push(`Un plazo vence en 5 días hábiles o menos (${d.titulo}).`);

  out.sort((a, b) => a.prioridad - b.prioridad);
  return { derechos: out, escalar: esc.length > 0, motivosEscalamiento: esc, vigencias: V, hoy };
}
