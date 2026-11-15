// Medir el ancho de una grieta con la tarjeta-regla: foto → tarjeta → toque → medida en mm (editable).
import { $, esc, ICON, toast, num, leerImagen, opciones } from '../ui/base.js';
import { S, guardarPredio } from '../nucleo/estado.js';
import { buscarTarjeta, rectificar, aplicar, escalaLocal, TARJETA } from '../medir/tarjeta.js';
import { medirGrieta } from '../medir/grieta.js';
import { ELEMENTOS, PATRONES, patronPorAngulo, leerGrieta, categoriaBRE } from '../medir/orientacion.js';

const COLOR = mm => (mm < 0.3 ? '#3ad29f' : mm < 1 ? '#ffd36b' : mm < 5 ? '#ff9c5b' : '#ff5b6e');

export async function render(main, id) {
  const pr = S.predios.get(id);
  if (!pr) { main.innerHTML = '<div class="card"><h2>No se encontró el expediente</h2><a class="btn" href="#/micasa">Volver</a></div>'; return; }
  const factor = S.ajustes.tarjetaFactor || 1;
  let foto = null, tarjeta = null, res = null, sens = 1, punto = null, grietaSel = pr.grietas[0]?.id || 'nueva';
  main.innerHTML = `
  <div class="cabecera"><div><h1>Medir una grieta</h1><p class="sub">${esc(pr.ubicacion.direccion || pr.id)} · <a href="#/expediente/${pr.id}">volver al expediente</a></p></div></div>
  <div class="col2">
    <div class="pila">
      <div class="card"><h3>1 · Ponga la tarjeta-regla junto a la grieta</h3>
        <p class="sub">Péguela al muro (cinta) a 1–5 cm de la grieta, derecha. Tome la foto de frente, a 15–25 cm, con buena luz y sin flash directo. ¿No tiene la tarjeta? <a href="#/tarjeta">Imprímala aquí</a>.</p>
        <div class="formulario" style="margin-top:8px">
          <label class="campo"><span>¿Qué grieta es?</span><select id="cual">${opciones([...pr.grietas.map((g, k) => [g.id, `Grieta ${k + 1} · ${ELEMENTOS[g.elemento] || ''} (última: ${g.ultima ? num(g.ultima.anchoMm, 2) + ' mm' : '—'})`]), ['nueva', 'Una grieta nueva']], grietaSel, null)}</select></label>
          <label class="campo"><span>¿Dónde está?</span><select id="elemento">${opciones(Object.entries(ELEMENTOS), pr.grietas.find(g => g.id === grietaSel)?.elemento || 'muroPortante', null)}</select></label>
        </div>
        <label class="btn pri grande bloque" style="margin-top:12px">${ICON.camara} Tomar la foto<input type="file" accept="image/*" capture="environment" id="archivo" hidden></label>
        ${factor !== 1 ? `<p class="tenue" style="margin-top:8px">Corrección de impresión activa: ×${num(factor, 3)}.</p>` : ''}
      </div>
      <div class="card" id="tarjetaEstado" hidden></div>
      <div class="lienzo-medida" id="lienzoCaja" hidden><canvas id="lienzo"></canvas></div>
      <p class="tenue" id="ayudaToque" hidden>2 · Toque sobre la grieta, cerca de su parte más ancha.</p>
    </div>
    <div class="pila" id="resultado"><div class="card"><h3>Cómo mide</h3><p class="sub">Con los dos marcadores de la tarjeta la app corrige la perspectiva y sabe cuántos píxeles hay en cada milímetro. Luego busca el valle oscuro de la grieta, traza su eje y mide el ancho cada 0,25 mm con el área bajo el perfil de gris, que no se deja engañar por el desenfoque.</p>
      <details class="saber"><summary>Ver las ecuaciones</summary><div class="formula">H = homografía tarjeta→foto (8 vértices, mínimos cuadrados, normalización de Hartley)
escala (px/mm) = √|det J(H)| en el punto tocado
fondo b = cierre morfológico (ventana &gt; ancho máximo)
ancho w = ∫ (b − I(x)) dx / C      C = profundidad del valle
ancho reportado = percentil 95 de w a lo largo del eje
incertidumbre u = 0,8 px / escala + w·(3 % + error de la tarjeta)
categoría = BRE Digest 251 (0: &lt;0,1 · 1: ≤1 · 2: ≤5 · 3: ≤15 · 4: ≤25 · 5: &gt;25 mm)</div></details></div></div>
  </div>`;

  const cv = $('#lienzo', main), ctx = cv.getContext('2d');
  let k = 1; // px del lienzo por px de la foto

  const dibujar = () => {
    if (!foto) return;
    const ancho = Math.min(foto.w, 1400);
    k = ancho / foto.w;
    cv.width = ancho; cv.height = Math.round(foto.h * k);
    ctx.drawImage(foto.lienzo, 0, 0, cv.width, cv.height);
    if (tarjeta?.ok) {
      ctx.strokeStyle = '#19d3c5'; ctx.lineWidth = 2;
      ctx.beginPath();
      [[0, 0], [TARJETA.ancho, 0], [TARJETA.ancho, TARJETA.alto], [0, TARJETA.alto]].forEach(([x, y], i) => { const [u, v] = aplicar(tarjeta.H, x, y); i ? ctx.lineTo(u * k, v * k) : ctx.moveTo(u * k, v * k); });
      ctx.closePath(); ctx.stroke();
    }
    if (res?.ok) {
      for (const m of res.muestras) {
        const [u, v] = aplicar(tarjeta.H, res.region[0] + m.x / res.escala, res.region[1] + m.y / res.escala);
        ctx.fillStyle = COLOR(m.mm * factor); ctx.beginPath(); ctx.arc(u * k, v * k, Math.max(2, 2.2 * cv.width / 900), 0, 7); ctx.fill();
      }
    }
    if (punto) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(punto[0] * k, punto[1] * k, 14, 0, 7); ctx.stroke(); }
  };

  const medir = () => {
    if (!punto || !tarjeta?.ok) return;
    const [mx, my] = aplicar(tarjeta.Hi, punto[0], punto[1]);
    const esc_ = Math.max(4, Math.min(28, Math.round(escalaLocal(tarjeta.H, mx, my))));
    const L = 14; // mm alrededor del toque
    const region = [mx - L, my - L, mx + L, my + L];
    const rec = rectificar(tarjeta.gris, foto.w, foto.h, tarjeta.H, region, esc_);
    const r = medirGrieta(rec.img, rec.w, rec.h, { escala: esc_, semilla: [rec.w / 2, rec.h / 2], sensibilidad: sens, errorEscala: tarjeta.errorEscala, maxAnchoMm: 10 });
    res = { ...r, region, escala: esc_, rec };
    dibujar(); pintarResultado();
  };

  function pintarResultado() {
    const R = $('#resultado', main);
    if (!res) return;
    if (!res.ok) { R.innerHTML = `<div class="aviso ambar">${ICON.alerta}<span>${esc(res.motivo)}</span></div>${controles()}`; enlazar(); return; }
    const w = +(res.anchoMm * factor).toFixed(2), u = +(res.incertidumbreMm * factor).toFixed(2);
    const elemento = $('#elemento', main).value, patron = patronPorAngulo(res.anguloHorizontal);
    const previa = pr.grietas.find(g => g.id === grietaSel)?.ultima;
    const lect = leerGrieta({ elemento, patron, anchoMm: w, previaMm: previa?.anchoMm }, S.ajustes.reglas);
    const cat = categoriaBRE(w);
    R.innerHTML = `<div class="card borde">
      <span class="tenue">Ancho de la grieta</span>
      <div class="resultado-grande">${res.noResuelta ? '≤ ' : ''}${num(w, 2)} <small>mm ${res.noResuelta ? '' : `± ${num(u, 2)}`}</small></div>
      <p class="sub" style="margin-top:6px">${res.noResuelta ? 'Más fina de lo que la cámara distingue a esta distancia: el valor es un máximo. Acérquese para afinar.' : `Rango ${num(res.rango[0] * factor, 2)}–${num(res.rango[1] * factor, 2)} mm`}</p>
      <div class="datos" style="margin-top:10px">
        <div class="dato"><span>Máximo puntual</span><b>${num(res.anchoMaxPuntualMm * factor, 2)}</b><small>mm</small></div>
        <div class="dato"><span>Largo medido</span><b>${num(res.largoMm * factor, 1)}</b><small>mm en la zona</small></div>
        <div class="dato"><span>Ángulo</span><b>${res.anguloHorizontal}°</b><small>${esc(PATRONES[patron] || 'otro')}</small></div>
        <div class="dato"><span>Categoría</span><b>${cat.cat}</b><small>${esc(cat.n)} (BRE 251)</small></div>
      </div>
      ${previa ? `<p class="sub" style="margin-top:8px">Medición anterior: ${num(previa.anchoMm, 2)} mm (${new Date(previa.fecha).toLocaleDateString('es-CO')}). Cambio: <b>${w - previa.anchoMm >= 0 ? '+' : ''}${num(w - previa.anchoMm, 2)} mm</b>.</p>` : ''}
      <div class="nivel ${lect.nivel === 'alerta' ? 'alerta' : lect.nivel === 'revision' ? 'revision' : 'calma'}" style="margin-top:10px"><b>${lect.nivel === 'alerta' ? 'Señal de alerta' : lect.nivel === 'revision' ? 'Requiere revisión' : 'Sin señal grave por esta grieta'}</b>${lect.razones.length ? `<ul>${lect.razones.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>
      <p class="tenue" style="margin-top:8px">Calidad: ${num(tarjeta.escala, 1)} px/mm en la tarjeta · perspectiva ${num(tarjeta.perspectiva * 100, 0)} % · error de reproyección ${num(tarjeta.rms, 2)} px.</p>
    </div>${controles(w, patron)}`;
    enlazar();
  }

  function controles(w = '', patron = 'otro') {
    return `<div class="card"><h3>Ajustar y guardar</h3><p class="sub">Si la app tomó una mancha o un borde, cambie la sensibilidad o toque otro punto. Si midió con el comparador de la tarjeta, escriba el valor: manda su medida.</p>
      <div class="formulario" style="margin-top:8px">
        <label class="campo"><span>Sensibilidad (${num(sens, 1)})</span><input id="sens" type="range" min="0.5" max="2" step="0.1" value="${sens}"></label>
        <label class="campo"><span>Patrón</span><select id="patron">${opciones(Object.entries(PATRONES), patron, 'Otro')}</select></label>
        <label class="campo"><span>Ancho corregido a mano (mm)</span><input id="manual" type="number" step="0.05" min="0" placeholder="${w}"></label>
      </div>
      <button class="btn pri bloque" id="guardarG" style="margin-top:10px" ${res?.ok || false ? '' : ''}>${ICON.ok} Guardar en el expediente</button></div>`;
  }

  function enlazar() {
    $('#sens', main)?.addEventListener('input', e => { sens = +e.target.value; medir(); });
    $('#guardarG', main)?.addEventListener('click', async () => {
      const manual = +$('#manual', main).value;
      if (!(res?.ok) && !(manual > 0)) return toast('Mida primero o escriba el ancho a mano.', 3000, 'error');
      const anchoMm = manual > 0 ? manual : +(res.anchoMm * factor).toFixed(2);
      const elemento = $('#elemento', main).value, patron = $('#patron', main).value || 'otro';
      let g = pr.grietas.find(x => x.id === grietaSel);
      if (!g) { g = { id: `g${pr.grietas.length + 1}-${Date.now().toString(36)}`, elemento, patron, mediciones: [] }; pr.grietas.push(g); grietaSel = g.id; }
      g.elemento = elemento; g.patron = patron;
      const miniatura = res?.ok ? miniaturaROI(res.rec) : null;
      const med = { fecha: new Date().toISOString(), anchoMm, manual: manual > 0, automatico: res?.ok ? { anchoMm: res.anchoMm * factor, incertidumbreMm: res.incertidumbreMm * factor, rango: res.rango.map(v => v * factor), noResuelta: res.noResuelta, largoMm: res.largoMm * factor, angulo: res.anguloHorizontal, escala: res.escala, calidad: { pxmm: tarjeta.escala, perspectiva: tarjeta.perspectiva, rms: tarjeta.rms } } : null, miniatura, factorTarjeta: factor };
      if (g.ultima) g.previa = g.ultima;
      g.ultima = med;
      g.mediciones = [...(g.mediciones || []), { ...med, miniatura: undefined }];
      await guardarPredio(pr, `Grieta medida: ${anchoMm} mm (${ELEMENTOS[elemento]})`);
      toast('Medición guardada en el expediente.');
      location.hash = `#/expediente/${pr.id}`;
    });
  }

  function miniaturaROI(rec) {
    const c = document.createElement('canvas'); c.width = rec.w; c.height = rec.h;
    const x = c.getContext('2d'), im = x.createImageData(rec.w, rec.h);
    for (let i = 0; i < rec.w * rec.h; i++) { const v = rec.img[i]; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0);
    const t = document.createElement('canvas'), L = 220; t.width = L; t.height = Math.round(L * rec.h / rec.w);
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    return t.toDataURL('image/jpeg', 0.7);
  }

  $('#cual', main).onchange = e => { grietaSel = e.target.value; const g = pr.grietas.find(x => x.id === grietaSel); if (g) $('#elemento', main).value = g.elemento; };
  $('#archivo', main).onchange = async e => {
    const f = e.target.files?.[0]; if (!f) return;
    const est = $('#tarjetaEstado', main);
    est.hidden = false; est.innerHTML = '<div class="fila"><span class="cargando"></span> Buscando la tarjeta en la foto…</div>';
    await new Promise(r => setTimeout(r, 30));
    try {
      foto = await leerImagen(f, 3000);
      tarjeta = buscarTarjeta(foto.rgba, foto.w, foto.h);
      res = null; punto = null;
      $('#lienzoCaja', main).hidden = false;
      dibujar();
      if (!tarjeta.ok) { est.innerHTML = `<div class="aviso ambar">${ICON.alerta}<span>${esc(tarjeta.motivo)}</span></div>`; $('#ayudaToque', main).hidden = true; return; }
      est.innerHTML = `<div class="fila entre"><span class="tag verde">${ICON.ok} Tarjeta encontrada · ${num(tarjeta.escala, 1)} px/mm</span><span class="tenue">${tarjeta.marcadores} marcador(es)</span></div>${tarjeta.avisos.map(a => `<div class="aviso ambar" style="margin-top:8px">${ICON.info}<span>${esc(a)}</span></div>`).join('')}`;
      $('#ayudaToque', main).hidden = false;
    } catch (err) { est.innerHTML = `<div class="aviso rojo">${ICON.alerta}<span>${esc(err.message)}</span></div>`; }
  };
  cv.addEventListener('click', e => {
    if (!tarjeta?.ok) return;
    const r = cv.getBoundingClientRect();
    punto = [(e.clientX - r.left) * (cv.width / r.width) / k, (e.clientY - r.top) * (cv.height / r.height) / k];
    medir();
  });
}
