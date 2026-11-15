/* ==========================================================================
   AXIONA EVALÚA · Corpus de derechos del sismo (v1)
   --------------------------------------------------------------------------
   Fichas por artículo, redactadas por Axiona a partir de las fuentes que se
   citan (resúmenes por artículo de SISJUR, comunicados oficiales y prensa
   jurídica). NO son el texto oficial: cada ficha tiene su fuente y su estado
   de revisión. Ninguna se presenta como «revisada» hasta que un abogado o un
   consultorio jurídico aliado la valide (estado: 'revisado').

   Formato: { id, norma, art, titulo, texto, temas, vigencia, fuente, estado, notas }
   Las fechas de vigencia que dependen de la publicación en el Diario Oficial
   se calculan en derechos/motor.js con fechas editables.
   ========================================================================== */

const SISJUR_1423 = 'https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=194293';
const MINVIVIENDA_1422 = 'https://www.minvivienda.gov.co/sala-de-prensa/minvivienda-establece-medidas-excepcionales-de-ordenamiento-territorial-para-acelerar-la-reconstruccion-tras-el-sismo-del-10-de-agosto';

export const CORPUS = [
  // ---------------- Desastre y emergencia ----------------
  { id: 'd1171-1', norma: 'Decreto 1171 de 2026', art: 'arts. 1 y 3', titulo: 'Situación de desastre nacional', temas: ['general', 'ayudas'],
    texto: 'El Gobierno declaró la situación de desastre de carácter nacional por el sismo de magnitud 7,4 del 10 de agosto de 2026 con epicentro en San José del Palmar (Chocó). Rige 12 meses desde el 11 de agosto de 2026 y se puede prorrogar por igual término. Crea la Subcuenta Sismo 2026 en el Fondo Nacional de Gestión del Riesgo de Desastres y ordena un Plan de Acción Específico. La declaratoria no crea por sí sola exenciones tributarias.',
    fuente: 'https://www.eltiempo.com/politica/gobierno/creacion-de-subcuenta-temporal-sismo-2026-y-otras-medidas-que-contempla-el-decreto-mediante-el-cual-se-declaro-el-desastre-nacional-por-el-terremoto-3577801', estado: 'pendiente' },
  { id: 'c366', norma: 'Sentencia C-366 de 2026', art: 'Corte Constitucional', titulo: 'Emergencia económica condicionada (Decretos 1261 y 1348)', temas: ['general', 'ayudas'],
    texto: 'La Corte Constitucional declaró exequible, con condiciones, la emergencia económica, social y ecológica del sismo (Decretos 1261 y 1348 de 2026). Las medidas solo aplican en los municipios con afectación según el reporte situacional n.º 54 de la UNGRD, no pueden usarse para problemas anteriores al 10 de agosto de 2026 ni para cubrir el déficit fiscal.',
    fuente: 'https://www.elcolombiano.com/negocios/corte-constitucional-avalo-emergencia-economica-terremoto-limito-gasto-gobierno-KL43481821', estado: 'pendiente', notas: 'Texto de la sentencia aún no publicado; ficha basada en el comunicado y la prensa.' },
  { id: 'circ73', norma: 'Circular UNGRD 73 de 2026', art: 'metodología', titulo: 'Cómo se evalúan las edificaciones', temas: ['evaluacion', 'general'],
    texto: 'La evaluación de edificaciones afectadas se hace en dos fases: una inspección visual rápida y una evaluación detallada. La realizan profesionales inscritos en el Registro Único de Profesionales Evaluadores (RUPE), con matrícula vigente. Las edificaciones se marcan con carteles verde, amarillo o rojo. El cartel verde no significa que la edificación no tenga daños, y el cartel rojo no es por sí mismo una orden de demolición.',
    fuente: 'https://www.radionacional.co/actualidad/politica/gobierno-nacional-anuncia-metodologia-para-evaluar-edificaciones-afectadas-por', estado: 'pendiente' },
  // ---------------- RUD y ayudas ----------------
  { id: 'rud-cierre', norma: 'Resolución UNGRD 0765 de 2026', art: 'RUD', titulo: 'Registro Único de Damnificados: cierre', temas: ['rud', 'ayudas'],
    texto: 'El Registro Único de Damnificados (RUD) del sismo cerró definitivamente el 4 de septiembre de 2026 a las 11:59 p. m. La inscripción no se hacía por internet: la alcaldía cargaba los datos. Hoy se puede consultar el registro y, si hay un error o una exclusión injustificada, pedir la corrección por derecho de petición ante la alcaldía o la UNGRD.',
    fuente: 'https://www.valledelcauca.gov.co/publicaciones/90395/atencion-el-4-de-septiembre-se-cierra-el-registro-de-damnificados-por-el-terremoto-del-10-de-agosto/', estado: 'pendiente', notas: 'No se ha confirmado ninguna reapertura general del RUD.' },
  { id: 'arriendo-ungrd', norma: 'UNGRD · apoyo económico temporal', art: 'requisitos', titulo: 'Apoyo para el arriendo de los damnificados', temas: ['ayudas', 'rud'],
    texto: 'Para el apoyo económico temporal de arriendo, el jefe de hogar debe estar en el RUD del sismo, haber residido en el municipio al momento del evento y tener la vivienda registrada como destruida o no habitable. Las cifras del monto publicadas por distintas fuentes no coinciden; el valor oficial es el de la resolución que lo reglamenta.',
    fuente: 'https://www.lafm.com.co/sociedad/terremoto-colombia-ungrd-entrega-apoyo-economico-temporal-familias-afectadas-409670', estado: 'pendiente', notas: 'No afirmar montos hasta tener la resolución reglamentaria.' },
  // ---------------- Arrendamiento (Decreto Legislativo 1423) ----------------
  { id: 'd1423-2', norma: 'Decreto Legislativo 1423 de 2026', art: 'art. 2', titulo: 'A quién aplican las medidas de arriendo', temas: ['arriendo', 'ph'],
    texto: 'Las medidas aplican solo en los municipios del ámbito de la emergencia y a quienes acrediten afectación directa mediante los registros oficiales del Sistema Nacional de Gestión del Riesgo o una verificación complementaria. No se aplican de forma general a todos los contratos del municipio.',
    fuente: SISJUR_1423, estado: 'pendiente' },
  { id: 'd1423-3', norma: 'Decreto Legislativo 1423 de 2026', art: 'art. 3', titulo: 'Suspensión de desalojos', temas: ['arriendo'],
    texto: 'Se suspende por seis meses la ejecución material de las restituciones y los desalojos de inmuebles de vivienda y comercio. Las excepciones son la evacuación por riesgo técnico y la necesidad del propietario de habitar el inmueble él o su familia cercana. La deuda de arriendo no desaparece.',
    fuente: SISJUR_1423, estado: 'pendiente' },
  { id: 'd1423-4', norma: 'Decreto Legislativo 1423 de 2026', art: 'art. 4', titulo: 'Reajuste del canon diferido', temas: ['arriendo'],
    texto: 'El reajuste anual del canon se difiere por seis meses. Lo diferido se paga después en cuotas iguales, sin intereses de mora.',
    fuente: SISJUR_1423, estado: 'pendiente' },
  { id: 'd1423-5', norma: 'Decreto Legislativo 1423 de 2026', art: 'art. 5', titulo: 'Prórroga del contrato a voluntad del arrendatario', temas: ['arriendo'],
    texto: 'Los contratos de arrendamiento que vencen entre el 10 de agosto y el 31 de diciembre de 2026 se prorrogan seis meses si el arrendatario afectado así lo decide.',
    fuente: SISJUR_1423, estado: 'pendiente' },
  { id: 'd1423-6', norma: 'Decreto Legislativo 1423 de 2026', art: 'art. 6', titulo: 'Excepciones: necesidad del propietario', temas: ['arriendo'],
    texto: 'Cuando el propietario necesita el inmueble para su vivienda o la de su familia cercana, debe dar un preaviso de 30 días calendario.',
    fuente: SISJUR_1423, estado: 'pendiente' },
  { id: 'd1423-7', norma: 'Decreto Legislativo 1423 de 2026', art: 'art. 7', titulo: 'Acuerdos de pago', temas: ['arriendo'],
    texto: 'Se promueven los acuerdos de pago entre arrendador y arrendatario. Si no hay acuerdo dentro de los 30 días siguientes al fin de la emergencia y el arrendatario declara su vulnerabilidad, lo diferido se paga en seis cuotas.',
    fuente: SISJUR_1423, estado: 'pendiente' },
  { id: 'd1423-8', norma: 'Decreto Legislativo 1423 de 2026', art: 'art. 8', titulo: 'Tope contra la especulación en los arriendos', temas: ['arriendo'],
    texto: 'Durante seis meses, el canon no puede superar el último canon pagado más el IPC, si hubo un contrato anterior sobre el inmueble. Si no lo hubo, rige el tope del artículo 18 de la Ley 820 de 2003.',
    fuente: SISJUR_1423, estado: 'pendiente' },
  { id: 'd1423-9', norma: 'Decreto Legislativo 1423 de 2026', art: 'art. 9', titulo: 'Avisos de arriendo y plataformas', temas: ['arriendo'],
    texto: 'Los avisos de arriendo deben incluir una declaración de cumplimiento de estas medidas. La Superintendencia de Industria y Comercio vigila las plataformas.',
    fuente: SISJUR_1423, estado: 'pendiente' },
  { id: 'd1423-13', norma: 'Decreto Legislativo 1423 de 2026', art: 'art. 13', titulo: 'Vigencia', temas: ['arriendo', 'ph'],
    texto: 'El decreto rige desde el día siguiente a su publicación. Las medidas de arrendamiento (Título I) duran seis meses y las de propiedad horizontal (Título II), veinticuatro meses.',
    fuente: SISJUR_1423, estado: 'pendiente', notas: 'Fecha de publicación en el Diario Oficial por confirmar (editable en Ajustes).' },
  // ---------------- Propiedad horizontal ----------------
  { id: 'd1423-10', norma: 'Decreto Legislativo 1423 de 2026', art: 'arts. 10 a 12', titulo: 'Copropiedades (propiedad horizontal)', temas: ['ph'],
    texto: 'Durante 24 meses las copropiedades afectadas pueden usar el fondo de imprevistos (hasta el 50 % sin asamblea si no hay consejo de administración), ofrecer planes de pago a los copropietarios y hacer asambleas virtuales o mixtas.',
    fuente: SISJUR_1423, estado: 'pendiente' },
  { id: 'd1448-ph', norma: 'Decreto 1448 de 2026', art: 'licencias', titulo: 'Reforzamiento estructural en propiedad horizontal', temas: ['ph', 'licencias'],
    texto: 'En edificios de propiedad horizontal afectados por el sismo, la licencia de reforzamiento estructural ya no exige el acta de la asamblea: la pide el representante legal declarando que la edificación fue afectada.',
    fuente: 'https://franciscofajardoabogados.com/decreto-1448-de-2026-modifica-el-regimen-de-licencias-urbanisticas-y-establece-medidas-transitorias-por-emergencia-sismica/', estado: 'pendiente' },
  // ---------------- Licencias y reconstrucción ----------------
  { id: 'd1448-lic', norma: 'Decreto 1448 de 2026', art: 'licencias', titulo: 'Demolición, reconstrucción y prórroga de licencias', temas: ['licencias'],
    texto: 'El decreto fija reglas para las licencias de demolición y reconstrucción de edificaciones afectadas, con límites en suelo de protección y en zonas de riesgo no mitigable. Además prorroga automáticamente por 12 meses las licencias urbanísticas vigentes en 16 departamentos.',
    fuente: 'https://franciscofajardoabogados.com/decreto-1448-de-2026-modifica-el-regimen-de-licencias-urbanisticas-y-establece-medidas-transitorias-por-emergencia-sismica/', estado: 'pendiente' },
  { id: 'd1422-rec', norma: 'Decreto Legislativo 1422 de 2026', art: 'reconocimiento', titulo: 'Reconocimiento de edificaciones afectadas', temas: ['licencias', 'titulacion'],
    texto: 'Las edificaciones afectadas por el sismo se pueden reconocer sin importar su fecha de terminación. También se prevén la legalización de asentamientos informales afectados y el saneamiento de la titulación. Aplica en el ámbito de la emergencia y a personas con afectación directa acreditada.',
    fuente: MINVIVIENDA_1422, estado: 'pendiente' },
  { id: 'd1422-pot', norma: 'Decreto Legislativo 1422 de 2026', art: 'ordenamiento', titulo: 'Ajustes al POT para la reconstrucción', temas: ['licencias'],
    texto: 'Durante cuatro años los municipios pueden hacer ajustes excepcionales y abreviados a su POT, e incorporar suelo rural o de expansión sin tocar suelos de protección ni zonas de riesgo no mitigable. Los concejos tienen 45 días para tramitarlos.',
    fuente: MINVIVIENDA_1422, estado: 'pendiente' },
  { id: 'd1422-reuso', norma: 'Decreto Legislativo 1422 de 2026', art: 'vivienda', titulo: 'Vivienda usada (reúso) con subsidio', temas: ['subsidios'],
    texto: 'Durante dos años, las viviendas de reúso (usadas) pueden acceder a los subsidios y la financiación previstos para vivienda nueva.',
    fuente: MINVIVIENDA_1422, estado: 'pendiente' },
  { id: 'd1422-curadurias', norma: 'Decreto Legislativo 1422 de 2026', art: 'licencias', titulo: 'Suspensión de términos en curadurías', temas: ['licencias'],
    texto: 'Los alcaldes pueden habilitar a los curadores urbanos para suspender los términos de licencias y reconocimientos por un máximo de 50 días hábiles en total. Las alcaldías pueden asumir trámites si los curadores no dan abasto.',
    fuente: MINVIVIENDA_1422, estado: 'pendiente' },
  // ---------------- Normas permanentes ----------------
  { id: 'cp-23', norma: 'Constitución Política', art: 'art. 23', titulo: 'Derecho de petición', temas: ['peticion'],
    texto: 'Toda persona tiene derecho a presentar peticiones respetuosas a las autoridades por motivos de interés general o particular y a obtener pronta resolución.',
    fuente: 'https://www.suin-juriscol.gov.co/viewDocument.asp?ruta=Constitucion/1687988', estado: 'pendiente' },
  { id: 'l1755-14', norma: 'Ley 1755 de 2015', art: 'art. 14', titulo: 'Plazos para responder peticiones', temas: ['peticion', 'rud'],
    texto: 'Salvo norma especial, toda petición debe resolverse dentro de los 15 días hábiles siguientes a su recepción. Las peticiones de documentos e información, dentro de los 10 días hábiles, y las consultas, dentro de los 30 días hábiles.',
    fuente: 'http://www.secretariasenado.gov.co/senado/basedoc/ley_1755_2015.html', estado: 'pendiente' },
  { id: 'cp-86', norma: 'Constitución Política y Decreto 2591 de 1991', art: 'art. 86 C. P.; art. 10 D. 2591', titulo: 'Acción de tutela', temas: ['tutela', 'rud', 'ayudas'],
    texto: 'Toda persona puede reclamar ante los jueces, mediante la acción de tutela, la protección inmediata de sus derechos fundamentales cuando sean vulnerados o amenazados por una autoridad. La tutela la puede presentar cualquier persona por sí misma, sin necesidad de abogado.',
    fuente: 'https://www.suin-juriscol.gov.co/viewDocument.asp?ruta=Constitucion/1687988', estado: 'pendiente' },
  { id: 'l820-18', norma: 'Ley 820 de 2003', art: 'art. 18', titulo: 'Canon máximo del arriendo de vivienda', temas: ['arriendo'],
    texto: 'El precio mensual del arrendamiento de vivienda urbana no puede exceder el uno por ciento (1 %) del valor comercial del inmueble.',
    fuente: 'http://www.secretariasenado.gov.co/senado/basedoc/ley_0820_2003.html', estado: 'pendiente' },
  { id: 'l820-20', norma: 'Ley 820 de 2003', art: 'art. 20', titulo: 'Reajuste anual del canon', temas: ['arriendo'],
    texto: 'Cada doce meses de ejecución del contrato el arrendador puede reajustar el canon en una proporción que no supere el 100 % del incremento del IPC del año calendario anterior, siempre que el nuevo canon no supere el tope del artículo 18.',
    fuente: 'http://www.secretariasenado.gov.co/senado/basedoc/ley_0820_2003.html', estado: 'pendiente' },
  { id: 'l2113', norma: 'Ley 2113 de 2021', art: 'consultorios jurídicos', titulo: 'Asesoría jurídica gratuita', temas: ['general', 'escalamiento'],
    texto: 'Los consultorios jurídicos de las universidades prestan, de forma gratuita, asesoría, conciliación, representación judicial y extrajudicial y acompañamiento en trámites administrativos, mediante estudiantes supervisados.',
    fuente: 'https://sidn.ramajudicial.gov.co/SIDN/NORMATIVA/TEXTOS_COMPLETOS/7_LEYES/LEYES%202021/Ley%202113%20de%202021%20(Consultorio%20juridico).pdf', estado: 'pendiente' },
  { id: 'l1581', norma: 'Ley 1581 de 2012', art: 'habeas data', titulo: 'Protección de sus datos personales', temas: ['general'],
    texto: 'Sus datos personales solo se pueden tratar con su autorización previa, expresa e informada, para la finalidad que se le explicó. Usted puede conocer, actualizar, rectificar y pedir la supresión de sus datos.',
    fuente: 'http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html', estado: 'pendiente' },
];

export const TEMAS = {
  general: 'Lo general del sismo', evaluacion: 'Evaluación de su casa', rud: 'Registro de damnificados (RUD)', ayudas: 'Ayudas y apoyo de arriendo',
  arriendo: 'Arriendo', ph: 'Edificios y conjuntos (propiedad horizontal)', licencias: 'Licencias y reconstrucción', subsidios: 'Subsidios de vivienda',
  titulacion: 'Títulos y legalización', peticion: 'Derecho de petición', tutela: 'Tutela', escalamiento: 'Asesoría gratuita',
};

export const ficha = id => CORPUS.find(f => f.id === id);
export const CORTE_CORPUS = '2026-11-15';
