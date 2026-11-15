// Agente Axiona: revisa una evaluación de fase 1 (formulario + fotos) con Claude, de Anthropic,
// a través del AI Gateway de Netlify (Netlify inyecta ANTHROPIC_API_KEY y ANTHROPIC_BASE_URL; aquí no
// se guarda ninguna clave). El agente SUGIERE: el cartel lo asigna y firma el evaluador (Circular 73).
import Anthropic from '@anthropic-ai/sdk';
import { r, pinValido, leerJSON } from '../lib/comun.mjs';

const MODELO = process.env.AGENTE_MODELO || 'claude-sonnet-5-5';

const SISTEMA = `Eres el Agente Axiona, asistente técnico de AXIONA EVALÚA en Quibdó (Chocó) y Pereira (Risaralda), Colombia, tras el sismo del 10 de agosto de 2026.
Apoyas la FASE 1 (inspección visual rápida) de la metodología unificada de la Circular Conjunta 73 de 2026 (UNGRD–IDIGER), con carteles:
- verde (Inspeccionada): ingreso y usos permitidos, sin condiciones severas ni daño estructural aparente que comprometa la seguridad;
- amarillo (Uso restringido): ocupación parcial o condicionada; requiere fase 2;
- rojo (Inseguro): ingreso prohibido salvo autorización escrita; requiere fase 2. El rojo NO es orden de demolición.
Reglas:
1. Tú SUGIERES; la clasificación es juicio del evaluador habilitado en el RUPE, que decide y firma. Nunca digas que asignas el cartel.
2. Sé conservador con la vida: ante evidencia de colapso, desplome, daño severo en columnas, vigas o nudos, o falla del terreno, sugiere rojo.
3. Basa cada afirmación en lo que se ve en las fotos o en lo marcado en el formulario. Si una foto no permite concluir, dilo.
4. Señala faltantes (fotos o datos que impiden decidir) e inconsistencias (lo marcado no coincide con las fotos, o datos contradictorios).
5. Contexto local: en Quibdó abundan la mampostería no reforzada, la madera y los palafitos (humedad, socavación, suelos blandos aluviales); en Pereira, la mampostería confinada, los pórticos y edificios de propiedad horizontal en laderas y rellenos.
6. Escribe en español claro y técnico, sin adornos. El borrador de concepto debe poder firmarse tras la revisión del ingeniero.`;

const ESQUEMA = {
  type: 'object', additionalProperties: false,
  required: ['cartel', 'confianza', 'justificacion', 'hallazgos', 'faltantes', 'inconsistencias', 'restricciones', 'fase2', 'borrador', 'recomendaciones'],
  properties: {
    cartel: { type: 'string', enum: ['verde', 'amarillo', 'rojo'] },
    confianza: { type: 'string', enum: ['baja', 'media', 'alta'] },
    justificacion: { type: 'string' },
    hallazgos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['foto', 'observacion'], properties: { foto: { type: 'string' }, observacion: { type: 'string' } } } },
    faltantes: { type: 'array', items: { type: 'string' } },
    inconsistencias: { type: 'array', items: { type: 'string' } },
    restricciones: { type: 'string' },
    fase2: { type: 'boolean' },
    borrador: { type: 'string' },
    recomendaciones: { type: 'array', items: { type: 'string' } },
  },
};

export default async (req) => {
  if (req.method !== 'POST') return r({ error: 'método' }, 405);
  if (!pinValido(req)) return r({ error: 'pin', mensaje: 'Código de acceso inválido.' }, 401);
  if (!(process.env.ANTHROPIC_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY)) return r({ error: 'sin_ia', mensaje: 'El AI Gateway de Netlify no está activo en este sitio.' }, 503);
  let d; try { d = await leerJSON(req); } catch (e) { return r({ error: e.message }, e.status || 400); }
  const ev = d.evaluacion || {};
  const fotos = (Array.isArray(d.fotos) ? d.fotos : []).filter(f => typeof f?.data === 'string' && f.data.startsWith('data:image/')).slice(0, 6);

  const contenido = [];
  for (const f of fotos) {
    const [cab, datos] = f.data.split(',');
    const tipo = (cab.match(/data:(image\/[a-z]+)/) || [])[1] || 'image/jpeg';
    contenido.push({ type: 'text', text: `Foto «${f.id}»:` });
    contenido.push({ type: 'image', source: { type: 'base64', media_type: tipo, data: datos } });
  }
  contenido.push({ type: 'text', text: `Formulario de fase 1 diligenciado por el equipo de campo (JSON):\n${JSON.stringify({ edificacion: ev.edificacion, condiciones: ev.condiciones, observaciones: ev.observaciones, ubicacion: ev.ubicacion, hogar: { personas: ev.hogar?.personas, menores: ev.hogar?.menores, mayores: ev.hogar?.mayores, discapacidad: ev.hogar?.discapacidad, zona: ev.hogar?.zona } }, null, 1)}\n\nFotos recibidas: ${fotos.map(f => f.id).join(', ') || 'ninguna'}.\nRevisa la evaluación y responde con la estructura indicada.` });

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 55000, apiKey: process.env.ANTHROPIC_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY, baseURL: process.env.ANTHROPIC_BASE_URL || process.env.NETLIFY_AI_GATEWAY_URL || process.env.NETLIFY_AI_GATEWAY_BASE_URL });
    const m = await client.messages.create({
      model: MODELO, max_tokens: 4000,
      system: SISTEMA,
      messages: [{ role: 'user', content: contenido }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } },
    });
    const texto = m.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const salida = JSON.parse(texto);
    return r({ ...salida, origen: 'claude', modelo: MODELO, fecha: new Date().toISOString() });
  } catch (e) {
    return r({ error: 'agente', mensaje: String(e?.error?.error?.message || e?.message || 'error').slice(0, 300) }, 502);
  }
};
export const config = { path: '/api/agente' };
