// Tarjeta-regla: imprimirla y comprobar la escala de la impresión.
import { $, esc, ICON, toast, descargarBlob, num } from '../ui/base.js';
import { S, guardarAjustes } from '../nucleo/estado.js';
import { pdfTarjetas, TARJETA } from '../medir/tarjeta.js';
import { celdas } from '@obra-vision/marcadores.js';

const svgTarjeta = () => {
  const k = TARJETA.lado / 6;
  const marcas = TARJETA.ids.map(id => celdas(id).flatMap((f, r) => f.map((v, c) => (v ? '' : `<rect x="${TARJETA.origen[id][0] + c * k}" y="${TARJETA.origen[id][1] + r * k}" width="${k + 0.02}" height="${k + 0.02}"/>`))).join('')).join('');
  const comp = [0.1, 0.2, 0.3, 0.5, 1, 2, 3].map((a, i) => `<rect x="${7 + i * 10.5}" y="22" width="${a}" height="12"/><text x="${7 + i * 10.5 + a / 2}" y="37.5" font-size="2.6" text-anchor="middle">${String(a).replace('.', ',')}</text>`).join('');
  const regla = [...Array(51)].map((_, i) => `<line x1="${17.8 + i}" x2="${17.8 + i}" y1="44" y2="${44 - (i % 10 === 0 ? 3 : i % 5 === 0 ? 2 : 1.1)}" stroke="#000" stroke-width="0.2"/>`).join('');
  return `<svg viewBox="0 0 ${TARJETA.ancho} ${TARJETA.alto}" style="width:100%;max-width:520px;background:#fff;border-radius:10px"><g fill="#000">${marcas}${comp}</g><text x="42.8" y="9" font-size="3.6" text-anchor="middle" font-weight="700">AXIONA · Tarjeta-regla</text>${regla}<line x1="17.8" x2="67.8" y1="44" y2="44" stroke="#000" stroke-width="0.25"/><text x="42.8" y="48.5" font-size="2.4" text-anchor="middle">Esta regla mide 50 mm</text></svg>`;
};

export async function render(main) {
  main.innerHTML = `<div class="cabecera"><div><h1>Tarjeta-regla</h1><p class="sub">Del tamaño de una cédula. Con ella el celular mide grietas en milímetros.</p></div><button class="btn pri grande" id="pdf">${ICON.imprimir} Descargar para imprimir (8 por hoja)</button></div>
  <div class="col2" style="margin-top:12px"><div class="card" style="text-align:center">${svgTarjeta()}<p class="tenue" style="margin-top:8px">Vista previa · imprima el PDF, no esta imagen.</p></div>
  <div class="pila"><div class="card"><h3>1 · Imprímala al 100 %</h3><p class="sub">En el cuadro de impresión elija «Tamaño real» o «100 %». Nunca «Ajustar a la página». Recorte por la línea punteada.</p></div>
    <div class="card"><h3>2 · Compruebe la escala</h3><p class="sub">Mida con una regla la línea de 50 mm de la tarjeta. Si no mide 50, escriba cuánto mide: la app corrige todas las medidas.</p>
      <div class="fila"><label class="campo" style="flex:1"><span>La línea mide (mm)</span><input id="medida" type="number" step="0.1" value="${num(50 * (S.ajustes.tarjetaFactor || 1), 1).replace(',', '.')}"></label><button class="btn" id="guardar" style="margin-top:20px">Guardar</button></div>
      <p class="tenue" id="factor">Factor actual: ×${num(S.ajustes.tarjetaFactor || 1, 3)}</p></div>
    <div class="card"><h3>3 · Úsela bien</h3><ul class="sub" style="padding-left:18px"><li>Pegue la tarjeta al muro, derecha, a 1–5 cm de la grieta.</li><li>Foto de frente, a 15–25 cm, que se vean los dos marcadores negros.</li><li>Buena luz, sin sombra fuerte sobre la grieta y sin flash directo.</li><li>El comparador de líneas sirve para medir a ojo cuando no hay celular.</li></ul></div></div></div>`;
  $('#pdf', main).onclick = async () => { descargarBlob('axiona-tarjetas-regla.pdf', await pdfTarjetas()); toast('PDF listo. Imprima al 100 %.'); };
  $('#guardar', main).onclick = async () => {
    const m = +$('#medida', main).value;
    if (!(m > 40 && m < 60)) return toast('Escriba un valor entre 40 y 60 mm.', 3000, 'error');
    S.ajustes.tarjetaFactor = +(m / 50).toFixed(4); await guardarAjustes();
    $('#factor', main).textContent = `Factor actual: ×${num(S.ajustes.tarjetaFactor, 3)}`; toast('Escala guardada.');
  };
}
export { esc };
