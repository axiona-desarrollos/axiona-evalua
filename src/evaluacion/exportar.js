/* ==========================================================================
   AXIONA EVALÚA · Exportaciones para EDAN y RUD (CSV, se abre en Excel)
   --------------------------------------------------------------------------
   Columnas de trabajo mientras la UNGRD y la Alcaldía definen el formato de
   cargue oficial; el mapeo se ajusta aquí.
   ========================================================================== */
import { CARTELES, SISTEMAS, ETNIAS, TENENCIAS } from './formulario.js';

const nombre = (lista, k) => (lista.find(([a]) => a === k) || [, k || ''])[1];
const celda = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const aCSV = (cab, filas) => '﻿' + [cab, ...filas].map(f => f.map(celda).join(';')).join('\r\n');

const firmadas = evs => evs.filter(e => e.estado === 'firmada');

export function csvEDAN(evs) {
  const cab = ['ID evaluación', 'ID edificación', 'Barrio', 'Dirección', 'Latitud', 'Longitud', 'Uso', 'Sistema estructural', 'Pisos', 'Hogares', 'Cartel', 'Restricciones', 'Remite a fase 2', 'Apuntalar', 'Evacuar', 'Fecha de firma', 'Evaluador', 'Matrícula', 'RUPE', 'Revisión', 'Sugerencia del Agente', 'Origen de la sugerencia'];
  const filas = firmadas(evs).map(e => [e.id, e.viviendaId, e.edificacion.barrio, e.edificacion.direccion, e.ubicacion.lat, e.ubicacion.lon, e.edificacion.uso, nombre(SISTEMAS, e.edificacion.sistema), e.edificacion.pisos, e.edificacion.hogares,
    CARTELES[e.decision.cartel]?.corto || '', e.decision.restricciones, e.decision.fase2 ? 'Sí' : 'No', e.decision.apuntalar ? 'Sí' : 'No', e.decision.evacuar ? 'Sí' : 'No', e.firmada, e.evaluador?.nombre, e.evaluador?.matricula, e.evaluador?.rupe, e.revision?.estado,
    CARTELES[e.agente?.cartel]?.corto || '', e.agente?.origen === 'claude' ? 'Agente Axiona (Claude)' : e.agente ? 'Reglas sin conexión' : '']);
  return aCSV(cab, filas);
}

export function csvRUD(evs) {
  const cab = ['ID evaluación', 'ID edificación', 'Barrio', 'Dirección', 'Zona', 'Jefe de hogar', 'Documento', 'Teléfono', 'Personas', 'Menores', 'Adultos mayores', 'Personas con discapacidad', 'Autorreconocimiento étnico', 'Tenencia', 'Consentimiento Ley 1581', 'Cartel', 'Concepto firmado por', 'Matrícula', 'Fecha'];
  const filas = firmadas(evs).map(e => [e.id, e.viviendaId, e.edificacion.barrio, e.edificacion.direccion, e.hogar.zona === 'rural' ? 'Rural dispersa' : 'Urbana', e.hogar.jefe, e.hogar.documento, e.hogar.telefono, e.hogar.personas, e.hogar.menores, e.hogar.mayores, e.hogar.discapacidad,
    nombre(ETNIAS, e.hogar.etnia), nombre(TENENCIAS, e.hogar.tenencia), e.hogar.consentimiento ? 'Sí' : 'No', CARTELES[e.decision.cartel]?.corto || '', e.evaluador?.nombre, e.evaluador?.matricula, e.firmada]);
  return aCSV(cab, filas);
}

export function descargar(nombreArchivo, texto, tipo = 'text/csv;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nombreArchivo; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
