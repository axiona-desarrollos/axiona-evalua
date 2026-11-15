/* ==========================================================================
   AXIONA EVALÚA · Preclasificación de respaldo (sin internet)
   --------------------------------------------------------------------------
   Cuando no hay señal, el Agente Axiona no puede consultar el modelo. Esta
   regla conservadora, inspirada en ATC-20, sugiere un cartel a partir de las
   condiciones marcadas. Es solo una sugerencia: el cartel lo asigna y firma
   el evaluador (Circular Conjunta 73: «la clasificación es un juicio del
   evaluador»).
   ========================================================================== */
import { CONDICIONES, NIVEL_TXT } from './formulario.js';

const ORDEN = { ninguno: 0, leve: 1, moderado: 2, severo: 3 };

export function preclasificar(ev) {
  const c = ev.condiciones || {};
  const razones = [];
  let cartel = 'verde';
  const subir = (a, r) => { if ((a === 'rojo') || (a === 'amarillo' && cartel === 'verde')) cartel = a; razones.push(r); };
  for (const d of CONDICIONES) {
    const n = ORDEN[c[d.id] || 'ninguno'];
    if (!n) continue;
    const txt = `${d.t}: ${NIVEL_TXT[c[d.id]].toLowerCase()}`;
    if (d.critica && n >= 2) subir('rojo', txt);
    else if (n >= 3) subir('rojo', txt);
    else if (d.critica && n === 1) subir('amarillo', txt);
    else if (n >= 2) subir('amarillo', txt);
    else razones.push(`${txt} (sin efecto en el cartel por sí solo)`);
  }
  const sistemaFragil = ['noReforzada', 'bahareque'].includes(ev.edificacion?.sistema);
  if (sistemaFragil && cartel === 'verde' && Object.values(c).some(v => ORDEN[v] >= 1)) subir('amarillo', 'Sistema estructural frágil con daño visible');
  const restricciones = cartel === 'rojo' ? 'Prohibido el ingreso salvo autorización escrita. Aislar el perímetro de posible caída.'
    : cartel === 'amarillo' ? 'Uso restringido: no ocupar las zonas afectadas; retirar elementos sueltos; acceso solo de adultos y por tiempo corto hasta la fase 2.'
      : '';
  return {
    origen: 'reglas', cartel, confianza: razones.length ? 'media' : 'baja',
    justificacion: razones.length ? `Sugerencia por reglas (sin conexión): ${razones.join('; ')}.` : 'No se marcaron daños. Verifique en sitio antes de asignar el cartel verde.',
    restricciones, fase2: cartel !== 'verde',
    hallazgos: [], faltantes: [], inconsistencias: [], borrador: '', recomendaciones: [],
    fecha: new Date().toISOString(),
  };
}
