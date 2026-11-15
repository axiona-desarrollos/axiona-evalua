// Medir el desplome de un muro o una columna con el acelerómetro, por inversión (cancela el sesgo del sensor).
import { $, esc, ICON, toast, num, opciones } from '../ui/base.js';
import { S, guardarPredio } from '../nucleo/estado.js';
import { capturar, inclinacion, quieto, inclinacionRapida, resumirLectura, LIMITES_DERIVA } from '../medir/inclinometro.js';

const ELEM = [['muro', 'Muro (cara del muro)'], ['columna', 'Columna o borde vertical']];

export async function render(main, id) {
  const pr = S.predios.get(id);
  if (!pr) { main.innerHTML = '<div class="card"><h2>No se encontró el expediente</h2></div>'; return; }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  let modo = 'muro', l1 = null, l2 = null, vivo = null;
  main.innerHTML = `
  <div class="cabecera"><div><h1>¿Está inclinado?</h1><p class="sub">${esc(pr.ubicacion.direccion || pr.id)} · <a href="#/expediente/${pr.id}">volver al expediente</a></p></div></div>
  <div class="col2">
    <div class="pila">
      <div class="card"><h3>Qué va a medir</h3>
        <div class="formulario" style="margin-top:8px">
          <label class="campo"><span>Elemento</span><select id="modo">${opciones(ELEM, modo, null)}</select></label>
          <label class="campo"><span>Altura del elemento (m)</span><input id="altura" type="number" step="0.1" min="0.5" value="${pr.vivienda.alturaM || 2.5}"></label>
          <label class="campo"><span>Nombre (para el informe)</span><input id="nombreEl" placeholder="Muro de fachada, columna esquina…"></label>
        </div></div>
      <div class="card" id="instr"></div>
    </div>
    <div class="pila"><div class="card"><h3>En vivo</h3><div class="burbuja" id="burbuja"><i></i></div><p class="sub" style="text-align:center;margin-top:8px" id="vivoTxt">Toque «Activar sensor».</p><button class="btn bloque" id="activar">${ICON.nivel} Activar sensor</button></div>
      <div id="res"></div>
      <details class="saber"><summary>Ver las ecuaciones</summary><div class="formula">Lectura = promedio de ~2 s del acelerómetro en reposo (x, y, z en m/s²)
Muro:    sen θ = (z₂ − z₁) / (|a₁| + |a₂|)   (espalda contra el muro / pantalla contra el muro)
Columna: sen φ = (x₁ − x₂) / (|a₁| + |a₂|)   (de pie / de cabeza)
El sesgo del sensor b aparece igual en las dos lecturas y se cancela.
deriva = tan θ × 100 %      desplome = H · tan θ
Lectura de la deriva residual (FEMA P-58): 0,2 % · 0,5 % · 1 % · 2 %</div></details></div>
  </div>`;

  const instr = () => {
    $('#instr', main).innerHTML = modo === 'muro'
      ? `<h3>Cómo medir un muro</h3><ol class="sub" style="padding-left:18px"><li>Apoye la <b>espalda</b> del celular contra el muro, de pie (lado largo vertical), a media altura. Quédese quieto y toque <b>Lectura 1</b>.</li><li>Gire el celular para que la <b>pantalla</b> quede contra el muro (mismo sitio, de pie) y toque <b>Lectura 2</b>.</li></ol>${botones()}`
      : `<h3>Cómo medir una columna</h3><ol class="sub" style="padding-left:18px"><li>Apoye el <b>canto largo</b> del celular contra la cara de la columna, de pie, pantalla hacia usted. Toque <b>Lectura 1</b>.</li><li>Póngalo <b>de cabeza</b> en el mismo sitio (gírelo 180° en su plano) y toque <b>Lectura 2</b>.</li></ol>${botones()}`;
    $('#l1', main).onclick = () => leer(1); $('#l2', main).onclick = () => leer(2);
  };
  const botones = () => `<div class="fila" style="margin-top:10px"><button class="btn ${l1 ? '' : 'pri'}" id="l1">${l1 ? '✓ ' : ''}Lectura 1</button><button class="btn ${l1 && !l2 ? 'pri' : ''}" id="l2" ${l1 ? '' : 'disabled'}>${l2 ? '✓ ' : ''}Lectura 2</button></div><p class="tenue" style="margin-top:6px">Cada lectura toma 2 segundos. No toque el celular mientras mide.</p>`;

  async function leer(n) {
    const b = $(`#l${n}`, main); b.disabled = true; b.innerHTML = '<span class="cargando"></span> Midiendo…';
    try {
      await new Promise(r => setTimeout(r, 600)); // deja de vibrar por el toque
      const l = await capturar(2200);
      if (!quieto(l)) { toast('El celular se movió. Apóyelo firme y repita.', 3500, 'error'); instr(); return; }
      if (n === 1) { l1 = l; l2 = null; } else l2 = l;
      instr();
      if (l1 && l2) calcular();
    } catch (e) { toast(e.message, 4000, 'error'); instr(); }
  }

  function calcular() {
    const H = +$('#altura', main).value || 2.5;
    const r = inclinacion(modo, l1, l2, H, { ios });
    const cls = r.lectura.clase === 'alta' ? 'alerta' : r.lectura.clase === 'media' ? 'revision' : 'calma';
    $('#res', main).innerHTML = `<div class="card borde"><span class="tenue">Desplome</span><div class="resultado-grande">${num(r.deriva, 2)} <small>% · ${num(r.grados, 2)}°</small></div>
      <p class="sub">${num(r.desplomeMm, 0)} mm en ${num(H, 1)} m de altura · ± ${num(r.incertidumbreDeriva, 2)} % · inclinado ${esc(r.hacia)}</p>
      <div class="nivel ${cls}" style="margin-top:8px"><b>${esc(r.lectura.n)}</b><span class="sub">Una inclinación pequeña puede venir de la construcción original: compare con un muro sin daño.</span></div>
      <p class="tenue" style="margin-top:8px">Sesgo del sensor cancelado: ${num(r.sesgoSensor, 3)} m/s².</p>
      <button class="btn pri bloque" id="guardarI" style="margin-top:10px">${ICON.ok} Guardar en el expediente</button></div>`;
    $('#guardarI', main).onclick = async () => {
      pr.inclinaciones.push({ id: `i${Date.now().toString(36)}`, elemento: $('#nombreEl', main).value.trim() || (modo === 'muro' ? 'Muro' : 'Columna'), modo, alturaM: H, grados: r.grados, deriva: r.deriva, desplomeMm: r.desplomeMm, incertidumbre: r.incertidumbreDeriva, lectura: r.lectura, razonLimite: r.razonLimite, fecha: new Date().toISOString() });
      await guardarPredio(pr, `Desplome medido: ${num(r.deriva, 2)} %`);
      toast('Medición guardada.'); location.hash = `#/expediente/${pr.id}`;
    };
  }

  $('#modo', main).onchange = e => { modo = e.target.value; l1 = l2 = null; $('#res', main).innerHTML = ''; instr(); };
  $('#altura', main).onchange = () => { if (l1 && l2) calcular(); };
  $('#activar', main).onclick = async () => {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function' && (await DeviceMotionEvent.requestPermission()) !== 'granted') throw new Error('Sin permiso para el sensor.');
      const buf = [];
      vivo = e => {
        const a = e.accelerationIncludingGravity; if (!a || a.x === null) return;
        buf.push([a.x, a.y, a.z]); if (buf.length > 12) buf.shift();
        const l = resumirLectura(buf), g = inclinacionRapida(modo, l);
        const bx = Math.max(-60, Math.min(60, (l.x / l.norma) * 600)), by = Math.max(-60, Math.min(60, (l.z / l.norma) * 600));
        $('#burbuja i', main).style.transform = `translate(${bx}px, ${by}px)`;
        $('#vivoTxt', main).textContent = `${num(g, 1)}° · aproximado, sin inversión`;
      };
      addEventListener('devicemotion', vivo);
      $('#activar', main).hidden = true;
    } catch (e) { toast(e.message, 3500, 'error'); }
  };
  instr();
  return () => { if (vivo) removeEventListener('devicemotion', vivo); };
}

export { LIMITES_DERIVA };
