/* ==========================================================================
   AXIONA EVALÚA · Almacén local (IndexedDB)
   --------------------------------------------------------------------------
   Todo se guarda primero en el teléfono: la app funciona sin internet y la
   sincronización sube lo pendiente cuando vuelve la señal.
   v2: se agregan los predios (expedientes) a las tablas de la v1.
   ========================================================================== */
const DB = 'axiona-evalua', VER = 2;
const TABLAS = ['viviendas', 'evaluaciones', 'ajustes', 'predios'];

let conexion = null;
function abrir() {
  if (conexion) return conexion;
  conexion = new Promise((ok, mal) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => TABLAS.forEach(t => { if (!r.result.objectStoreNames.contains(t)) r.result.createObjectStore(t, { keyPath: 'id' }); });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  return conexion;
}
const tx = async (t, modo, fn) => {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const x = db.transaction(t, modo), s = x.objectStore(t);
    const res = fn(s);
    x.oncomplete = () => ok(res?.result ?? res);
    x.onerror = () => mal(x.error);
  });
};

export const todos = t => tx(t, 'readonly', s => s.getAll());
export const uno = (t, id) => tx(t, 'readonly', s => s.get(id));
export const guardar = (t, obj) => tx(t, 'readwrite', s => { s.put(obj); return obj; });
export const guardarVarios = (t, lista) => tx(t, 'readwrite', s => { lista.forEach(o => s.put(o)); return lista.length; });
export const borrar = (t, id) => tx(t, 'readwrite', s => s.delete(id));

export async function ajuste(id, valor) {
  if (valor === undefined) return (await uno('ajustes', id))?.v;
  await guardar('ajustes', { id, v: valor });
  return valor;
}
