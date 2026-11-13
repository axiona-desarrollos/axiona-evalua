// Utilidades comunes de las funciones de AXIONA EVALÚA.
import { createHash, timingSafeEqual } from 'node:crypto';

export const r = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
});

const h = s => createHash('sha256').update(String(s || '')).digest();

/** El código de acceso vive en la variable ACCESO_PIN de Netlify (nunca en el código). */
export function pinValido(req, pin) {
  const esperado = process.env.ACCESO_PIN;
  if (!esperado) return false;
  const dado = pin ?? req.headers.get('x-acceso') ?? '';
  return timingSafeEqual(h(dado), h(esperado));
}

export async function leerJSON(req, max = 6_000_000) {
  const t = await req.text();
  if (t.length > max) { const e = new Error('demasiado_grande'); e.status = 413; throw e; }
  try { return JSON.parse(t || '{}'); } catch { const e = new Error('json'); e.status = 400; throw e; }
}
