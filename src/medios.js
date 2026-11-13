/* ==========================================================================
   AXIONA EVALÚA · Fotos, ubicación y firma
   ========================================================================== */

/** Comprime una foto a JPEG (lado mayor ≤ 1280 px) y le estampa fecha, hora y coordenadas. */
export async function prepararFoto(archivo, sello) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const w = Math.round(img.width * k), h = Math.round(img.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, w, h);
    if (sello) {
      const fs = Math.max(14, Math.round(w / 48));
      x.font = `600 ${fs}px Inter, sans-serif`;
      const t = sello, tw = x.measureText(t).width;
      x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, h - fs * 1.9, Math.min(w, tw + fs * 1.2), fs * 1.9);
      x.fillStyle = '#fff'; x.fillText(t, fs * 0.6, h - fs * 0.62);
    }
    return c.toDataURL('image/jpeg', 0.72);
  } finally { URL.revokeObjectURL(url); }
}

/** Ubicación GPS con tiempo límite. */
export function ubicar(timeout = 15000) {
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) return mal(new Error('Este equipo no tiene GPS disponible.'));
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), precision: Math.round(p.coords.accuracy), gps: true, hora: new Date().toISOString() }),
      e => mal(new Error(e.code === 1 ? 'Permiso de ubicación negado: actívalo en el navegador.' : 'No se pudo obtener la ubicación. Sal a cielo abierto e intenta de nuevo.')),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
}

/** Lienzo de firma con el dedo o el mouse. Devuelve { limpiar, imagen, vacia }. */
export function lienzoFirma(canvas) {
  const x = canvas.getContext('2d');
  const ajustar = () => {
    const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    canvas.width = r.width * d; canvas.height = r.height * d; x.scale(d, d);
    x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#0b1f33';
  };
  ajustar();
  let pintando = false, trazos = 0;
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', e => { pintando = true; canvas.setPointerCapture(e.pointerId); const [a, b] = pos(e); x.beginPath(); x.moveTo(a, b); });
  canvas.addEventListener('pointermove', e => { if (!pintando) return; const [a, b] = pos(e); x.lineTo(a, b); x.stroke(); trazos++; });
  const fin = () => { pintando = false; };
  canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin);
  return {
    limpiar() { x.clearRect(0, 0, canvas.width, canvas.height); trazos = 0; },
    imagen: () => canvas.toDataURL('image/png'),
    vacia: () => trazos < 5,
  };
}
