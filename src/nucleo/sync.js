// Envía al servidor las solicitudes que se hicieron sin señal.
import { S } from './estado.js';
import * as A from './almacen.js';
import { enviarSolicitud } from './red.js';

let enviando = false;
export async function enviarPendientes() {
  if (enviando || !navigator.onLine) return 0;
  enviando = true;
  let n = 0;
  try {
    for (const p of S.predios.values()) {
      if (p.demo || p.sincronizado || !p.solicitudEnviada) continue;
      try {
        const r = await enviarSolicitud(p);
        if (p.estado === 'borrador') p.estado = 'reportado';
        p.recibido = r.recibido || p.recibido;
        p.sincronizado = true;
        await A.guardar('predios', p);
        n++;
      } catch { /* se reintenta con la próxima señal */ }
    }
  } finally { enviando = false; }
  return n;
}
