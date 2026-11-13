// Verifica el código de acceso de la plataforma.
import { r, pinValido, leerJSON } from '../lib/comun.mjs';

export default async (req) => {
  if (req.method !== 'POST') return r({ error: 'método' }, 405);
  const d = await leerJSON(req, 2000).catch(() => ({}));
  await new Promise(ok => setTimeout(ok, 350)); // frena intentos por fuerza bruta
  return pinValido(req, d.pin) ? r({ ok: true }) : r({ error: 'pin' }, 401);
};
export const config = { path: '/api/acceso' };
