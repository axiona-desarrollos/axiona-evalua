// «Mis derechos»: responde preguntas abiertas SOLO con citas a las fichas del corpus curado
// (Claude Haiku 5.5 + API de Citations, a través del AI Gateway de Netlify; aquí no hay ninguna clave).
// Las fechas y cifras las calcula la app (motor determinista) y llegan como contexto no citable.
import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '@netlify/blobs';
import { CORPUS, TEMAS } from '../../src/derechos/corpus.js';
import { r, leerJSON } from '../lib/comun.mjs';

const MODELO = process.env.DERECHOS_MODELO || 'claude-haiku-5-5';
const POR_IP_DIA = 40;

const SISTEMA = `Eres el asistente «Mis derechos» de AXIONA EVALÚA para damnificados del sismo del 10 de agosto de 2026 en Colombia (Quibdó y Pereira).
Reglas estrictas:
1. Responde SOLO con base en los documentos entregados (fichas de normas) y cita cada afirmación jurídica. Si los documentos no cubren la pregunta, dilo con claridad y recomienda el consultorio jurídico gratuito, la Personería o la Defensoría del Pueblo.
2. Es información jurídica general, no asesoría ni representación. No digas «usted gana», «tiene derecho seguro» ni prometas resultados.
3. No afirmes montos de ayudas que no estén en las fichas. Las fechas límite y los cálculos vienen en el contexto calculado por la app: úsalos tal cual, sin recalcular.
4. Si hay desalojo en curso, niegan una ayuda, plazos de menos de 5 días, menores, personas con discapacidad o conflictos de propiedad, recomienda buscar hoy el consultorio jurídico o la Personería.
5. Español sencillo, frases cortas, sin jerga. Máximo 180 palabras. Termina con 1 a 3 pasos concretos.`;

/** Un documento por norma; un bloque por ficha (cita a nivel de ficha). */
function documentos() {
  const porNorma = new Map();
  for (const f of CORPUS) {
    if (!porNorma.has(f.norma)) porNorma.set(f.norma, []);
    porNorma.get(f.norma).push(f);
  }
  const docs = [], mapa = [];
  for (const [norma, fichas] of porNorma) {
    mapa.push(fichas.map(f => f.id));
    docs.push({
      type: 'document', title: norma,
      context: `Fichas resumidas por Axiona (no es el texto oficial). Temas: ${[...new Set(fichas.flatMap(f => f.temas))].map(t => TEMAS[t]).join(', ')}.`,
      source: { type: 'content', content: fichas.map(f => ({ type: 'text', text: `${f.norma}, ${f.art} — ${f.titulo}. ${f.texto}` })) },
      citations: { enabled: true },
    });
  }
  docs[docs.length - 1].cache_control = { type: 'ephemeral' };
  return { docs, mapa };
}

async function cupo(req) {
  try {
    const ip = req.headers.get('x-nf-client-connection-ip') || 'x';
    const dia = new Date().toISOString().slice(0, 10);
    const st = getStore({ name: 'cupos-derechos' });
    const k = `${dia}/${ip}`;
    const n = (await st.get(k, { type: 'json' })) || 0;
    if (n >= POR_IP_DIA) return false;
    await st.setJSON(k, n + 1);
    return true;
  } catch { return true; }
}

export default async (req) => {
  if (req.method !== 'POST') return r({ error: 'método' }, 405);
  if (!(process.env.ANTHROPIC_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY)) return r({ error: 'sin_ia', mensaje: 'El asistente no está activo. Use la guía paso a paso.' }, 503);
  let d; try { d = await leerJSON(req, 20000); } catch (e) { return r({ error: e.message }, e.status || 400); }
  const pregunta = String(d.pregunta || '').trim().slice(0, 800);
  if (pregunta.length < 4) return r({ error: 'pregunta' }, 400);
  if (!(await cupo(req))) return r({ error: 'cupo', mensaje: 'Llegó al límite de preguntas de hoy. Mañana puede seguir, o use la guía paso a paso.' }, 429);
  const contexto = String(d.contexto || '').slice(0, 3000);
  const { docs, mapa } = documentos();
  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 45000, apiKey: process.env.ANTHROPIC_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY, baseURL: process.env.ANTHROPIC_BASE_URL || process.env.NETLIFY_AI_GATEWAY_URL || process.env.NETLIFY_AI_GATEWAY_BASE_URL });
    const m = await client.messages.create({
      model: MODELO, max_tokens: 3000, system: SISTEMA, output_config: { effort: 'low' },
      messages: [{ role: 'user', content: [...docs, { type: 'text', text: `Situación calculada por la app (no citable): ${contexto || 'sin datos'}\n\nPregunta del ciudadano: ${pregunta}` }] }],
    });
    // texto con sus citas → ids de ficha
    const partes = [];
    for (const b of m.content) {
      if (b.type !== 'text') continue;
      const citas = (b.citations || []).filter(c => c.type === 'content_block_location').flatMap(c => {
        const ids = mapa[c.document_index] || [];
        const out = [];
        for (let i = c.start_block_index; i < c.end_block_index; i++) if (ids[i]) out.push(ids[i]);
        return out;
      });
      partes.push({ texto: b.text, citas: [...new Set(citas)] });
    }
    const conCitas = partes.some(p => p.citas.length);
    if (!partes.length) return r({ error: 'vacia', mensaje: 'El asistente no devolvió texto.', diag: { stop: m.stop_reason, tipos: m.content.map(b => b.type), uso: m.usage } }, 502);
    return r({ partes, conCitas, modelo: MODELO, fecha: new Date().toISOString() });
  } catch (e) {
    return r({ error: 'asistente', mensaje: String(e?.error?.error?.message || e?.message || 'error').slice(0, 300) }, 502);
  }
};
export const config = { path: '/api/derechos' };
