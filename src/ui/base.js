/* ==========================================================================
   AXIONA EVALÚA · Utilidades de interfaz
   ========================================================================== */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const num = (v, d = 1) => (v === null || v === undefined || Number.isNaN(+v) ? '—' : (+v).toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: 0 }));
export const pesos = v => (v === null || v === undefined ? '—' : '$ ' + Math.round(v).toLocaleString('es-CO'));
export const fechaCorta = iso => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fechaHora = iso => (iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '');
export const opciones = (lista, v, vacia = 'Seleccione…') => (vacia === null ? '' : `<option value="">${vacia}</option>`) + lista.map(([k, n]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('');

export function toast(t, ms = 2800, tipo = '') {
  const d = document.createElement('div');
  d.className = `toast ${tipo}`; d.setAttribute('role', 'status'); d.textContent = t;
  document.body.append(d);
  requestAnimationFrame(() => d.classList.add('ver'));
  setTimeout(() => { d.classList.remove('ver'); setTimeout(() => d.remove(), 300); }, ms);
}

/** Ventana modal. Devuelve { el, cerrar, promesa }. */
export function modal(html, { ancho = 560, alCerrar } = {}) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="max-width:${ancho}px"><button class="modal-x" aria-label="Cerrar">${ICON.x}</button>${html}</div>`;
  document.body.append(fondo);
  let resolver;
  const promesa = new Promise(ok => { resolver = ok; });
  const cerrar = v => { fondo.remove(); document.removeEventListener('keydown', tecla); alCerrar?.(v); resolver(v); };
  const tecla = e => { if (e.key === 'Escape') cerrar(null); };
  document.addEventListener('keydown', tecla);
  fondo.addEventListener('click', e => { if (e.target === fondo) cerrar(null); });
  $('.modal-x', fondo).onclick = () => cerrar(null);
  return { el: $('.modal', fondo), cerrar, promesa };
}

export async function confirmar(titulo, texto, { si = 'Sí', no = 'Cancelar', peligro = false } = {}) {
  const m = modal(`<h3>${esc(titulo)}</h3><p class="sub">${esc(texto)}</p><div class="fila fin"><button class="btn" data-r="0">${esc(no)}</button><button class="btn ${peligro ? 'peligro' : 'pri'}" data-r="1">${esc(si)}</button></div>`, { ancho: 440 });
  m.el.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) m.cerrar(b.dataset.r === '1'); });
  return !!(await m.promesa);
}

export function descargarBlob(nombre, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Íconos SVG (trazo, 24×24). */
const i = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  casa: i('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  casco: i('<path d="M4 16a8 8 0 0 1 16 0"/><path d="M2 16h20v3H2z"/><path d="M12 8V5M9 9 8 6M15 9l1-3"/>'),
  mapa: i('<path d="m9 4-6 3v13l6-3 6 3 6-3V4l-6 3z"/><path d="M9 4v13M15 7v13"/>'),
  balanza: i('<path d="M12 4v16M7 20h10M5 8h14"/><path d="m5 8-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z"/>'),
  regla: i('<path d="m3 17 14-14 4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>'),
  nivel: i('<rect x="2" y="9" width="20" height="6" rx="2"/><circle cx="12" cy="12" r="1.6"/><path d="M9 9v6M15 9v6"/>'),
  camara: i('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  ubicacion: i('<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
  ondas: i('<path d="M2 12h3l2-6 4 12 3-9 2 3h6"/>'),
  doc: i('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
  lista: i('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  tablero: i('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>'),
  ajustes: i('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  topo: i('<path d="M3 20 9 8l4 7 3-4 5 9z"/><circle cx="17" cy="5" r="2"/>'),
  plano: i('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h9V3M12 12v9M12 16h9"/>'),
  alerta: i('<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>'),
  ok: i('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
  info: i('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>'),
  x: i('<path d="M6 6l12 12M18 6 6 18"/>'),
  flecha: i('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  atras: i('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  enviar: i('<path d="m3 11 18-8-8 18-2-8z"/>'),
  descargar: i('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
  whatsapp: i('<path d="M4 20l1.3-4A8 8 0 1 1 8 19.2z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z"/>'),
  persona: i('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  lapiz: i('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
  candado: i('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  nube: i('<path d="M7 18a5 5 0 1 1 .6-10A6 6 0 0 1 19 9a4.5 4.5 0 0 1-1 9z"/>'),
  imprimir: i('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  chispa: i('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
};

/** Pasos de un asistente (barra de progreso con etiquetas). */
export function barraPasos(pasos, actual) {
  return `<ol class="pasos" aria-label="Pasos">${pasos.map((p, k) => `<li class="${k < actual ? 'hecho' : k === actual ? 'actual' : ''}"><span>${k < actual ? '✓' : k + 1}</span><b>${esc(p)}</b></li>`).join('')}</ol>`;
}

/** Imagen desde un archivo: RGBA y lienzo, con tope de lado. */
export async function leerImagen(archivo, ladoMax = 3000) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => mal(new Error('No se pudo leer la foto.')); im.src = url; });
    const k = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    return { lienzo: c, w, h, rgba: x.getImageData(0, 0, w, h).data };
  } finally { URL.revokeObjectURL(url); }
}
