// Expediente por predio: el lugar donde se une todo (ciudadano, evaluación, Topo, Obra, derechos y documentos).
import { $, esc, ICON, toast, num, pesos, fechaHora, fechaCorta, opciones, confirmar } from '../ui/base.js';
import { S, guardarPredio, integrarPuente, cargarMalla, nsrCiudad, borrarPredio } from '../nucleo/estado.js';
import { ESTADOS, FLUJO } from '../nucleo/predio.js';
import { CIUDADES } from '../nucleo/ciudades.js';
import { coordTexto, distancia } from '../nucleo/geo.js';
import { textoMMI, nivelFalla, demandaVsDiseno, sismoEnSitio } from '../sismo/sitio.js';
import { PERFILES, SISTEMAS_PERIODO } from '../sismo/nsr10.js';
import { puntaje, NOMBRES_COMPONENTES } from '../nucleo/prioridad.js';
import { ELEMENTOS, PATRONES, categoriaBRE } from '../medir/orientacion.js';
import { graficaEspectro, barras } from '../ui/graficas.js';
import { abrirTopo, abrirObra } from '../expediente/enlaces.js';
import { CARTELES } from '../evaluacion/formulario.js';

const PESTANAS = [['resumen', 'Resumen', ICON.casa], ['sismo', 'Sismo en el sitio', ICON.ondas], ['mediciones', 'Mediciones', ICON.regla], ['fotos', 'Fotos', ICON.camara], ['tecnico', 'Evaluación y diseño', ICON.casco], ['documentos', 'Documentos', ICON.doc], ['historial', 'Historial', ICON.lista]];

export async function render(main, id) {
  const pr = S.predios.get(id);
  if (!pr) { main.innerHTML = `<div class="card"><h2>No se encontró el expediente ${esc(id)}</h2><p class="sub">Puede estar en otro teléfono. En Axiona Pro se consultan los expedientes recibidos.</p><a class="btn" href="#/">Inicio</a></div>`; return; }
  if (await integrarPuente(pr)) toast('Expediente actualizado con lo que hizo en Topo / Obra.');
  await cargarMalla(pr.ciudad);
  let tab = (location.hash.split('?t=')[1]) || 'resumen';
  const pro = S.modo === 'pro';
  const C = CIUDADES[pr.ciudad];

  function pintar() {
    const o = pr.orientacion || { nivel: 'sin_senales', t: '', d: '', razones: [], acciones: [], clase: 'calma' };
    const iFlujo = FLUJO.indexOf(pr.estado);
    main.innerHTML = `
    <div class="cabecera"><div><span class="tenue mono">${esc(pr.id)}${pr.demo ? ' · <span class="tag demo">demostración</span>' : ''}</span><h1 style="margin-top:4px">${esc(pr.ubicacion.direccion || 'Vivienda sin dirección')}</h1>
      <p class="sub">${esc(pr.ubicacion.barrio ? pr.ubicacion.barrio + ' · ' : '')}${esc(C.nombre)} · ${esc(ESTADOS[pr.estado] || pr.estado)} · actualizado ${fechaHora(pr.actualizado)}</p></div>
      <div class="fila">${pr.origen === 'ciudadano' && pr.estado === 'borrador' ? `<a class="btn pri" href="#/reportar/${pr.id}">Continuar el reporte</a>` : ''}<button class="btn" id="pdf">${ICON.descargar} Expediente PDF</button></div></div>
    <div class="flujo">${FLUJO.map((e, k) => `<span class="${k < iFlujo ? 'hecho' : k === iFlujo ? 'actual' : ''}">${esc(ESTADOS[e])}</span>`).join('')}</div>
    <div class="pestanas" role="tablist">${PESTANAS.map(([k, t, ic]) => `<button role="tab" data-t="${k}" aria-selected="${k === tab}">${ic}${t}</button>`).join('')}</div>
    <div id="cuerpo"></div>`;
    $('.pestanas', main).onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; history.replaceState(null, '', `#/expediente/${pr.id}?t=${tab}`); pintar(); } };
    $('#pdf', main).onclick = async () => { const { pdfExpediente } = await import('../expediente/pdf.js'); await pdfExpediente(pr); };
    ({ resumen, sismo: tabSismo, mediciones, fotos, tecnico, documentos, historial })[tab]($('#cuerpo', main), o);
  }

  function resumen(B, o) {
    const P = puntaje(pr, { pesos: S.ajustes.pesos, fragilidad: S.ajustes.fragilidad });
    const ev = pr.evaluacionResumen;
    B.innerHTML = `<div class="col2"><div class="pila">
      <div class="nivel ${o.clase}"><h3>${o.nivel === 'alerta' ? ICON.alerta : o.nivel === 'revision' ? ICON.info : ICON.ok} ${esc(o.t)}</h3><p>${esc(o.d)}</p>${o.razones.length ? `<ul>${o.razones.slice(0, 8).map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}${o.acciones.length ? `<ul>${o.acciones.map(a => `<li><b>${esc(a)}</b></li>`).join('')}</ul>` : ''}</div>
      ${ev?.cartel ? `<div class="card"><h3>Evaluación profesional (Circular 73)</h3><p><span class="tag" style="color:${CARTELES[ev.cartel].color};border-color:${CARTELES[ev.cartel].color}">${esc(CARTELES[ev.cartel].nombre)}</span></p><p class="sub">${esc(CARTELES[ev.cartel].texto)}</p>${ev.restricciones ? `<p>${esc(ev.restricciones)}</p>` : ''}<p class="tenue">Firmada por ${esc(ev.evaluador || '')} · ${fechaCorta(ev.fecha)}</p></div>` : ''}
      <div class="card"><h3>Acciones</h3><div class="fila" style="margin-top:8px">
        <a class="btn" href="#/medir/grieta/${pr.id}">${ICON.regla} Medir grieta</a><a class="btn" href="#/medir/inclinacion/${pr.id}">${ICON.nivel} Medir desplome</a><a class="btn" href="#/derechos/${pr.id}">${ICON.balanza} Derechos</a>
        ${pro ? `<a class="btn pri" href="#/pro/evaluar/${pr.id}">${ICON.casco} Evaluar (fase 1)</a><button class="btn" id="topo">${ICON.topo} Medir el lote</button><button class="btn" id="obra">${ICON.plano} Diseñar y presupuestar</button>` : ''}
      </div></div>
    </div><div class="pila">
      <div class="card"><h3>Datos</h3><table class="tabla">
        <tr><th>Ubicación</th><td>${esc(coordTexto(pr.ubicacion))}${pr.ubicacion.precision ? ` · ±${pr.ubicacion.precision} m` : ''}${pr.ubicacion.referencia ? `<br><span class="tenue">${esc(pr.ubicacion.referencia)}</span>` : ''}</td></tr>
        <tr><th>Vivienda</th><td>${esc(pr.vivienda.sistema || 'sistema sin definir')} · ${pr.vivienda.pisos} piso(s)${pr.vivienda.ph ? ' · propiedad horizontal' : ''}</td></tr>
        <tr><th>Hogar</th><td>${pr.hogar.personas || '—'} personas${+pr.hogar.menores ? ` · ${pr.hogar.menores} menores` : ''}${+pr.hogar.mayores ? ` · ${pr.hogar.mayores} mayores` : ''}${+pr.hogar.discapacidad ? ` · ${pr.hogar.discapacidad} con discapacidad` : ''}</td></tr>
        <tr><th>Contacto</th><td>${pro || pr.origen === 'ciudadano' ? esc(pr.contacto.nombre || '—') + (pr.contacto.telefono ? ' · ' + esc(pr.contacto.telefono) : '') : 'reservado'}</td></tr>
        <tr><th>Sismo</th><td>${pr.sismo ? `MMI ${num(pr.sismo.mmi)} · PGA ${num(pr.sismo.pga)} %g` : '—'}</td></tr>
        <tr><th>Mediciones</th><td>${pr.grietas.length} grieta(s) · ${pr.inclinaciones.length} desplome(s) · ${pr.fotos.length} foto(s)</td></tr>
      </table></div>
      ${pro ? `<div class="card"><div class="fila entre"><h3>Prioridad</h3><span class="tag ${P.banda.id}">${esc(P.banda.n)} · ${num(P.puntaje, 0)}</span></div>
        ${barras(Object.entries(P.aportes).map(([k, v]) => [NOMBRES_COMPONENTES[k], v, 100 * S.ajustes.pesos[k] / Object.values(S.ajustes.pesos).reduce((a, b) => a + b, 0), num(v, 1)]))}
        <p class="tenue" style="margin-top:8px">P = 100 · Σ wᵢ·cᵢ${P.grave ? ' · señal grave: 80 + 0,2·P' : ''}. Pesos editables en Ajustes.</p>
        <div class="fila" style="margin-top:8px"><select id="estado" style="max-width:240px">${opciones(Object.entries(ESTADOS), pr.estado, null)}</select></div></div>` : ''}
    </div></div>`;
    $('#topo', B)?.addEventListener('click', () => abrirTopo(pr));
    $('#obra', B)?.addEventListener('click', () => abrirObra(pr));
    $('#estado', B)?.addEventListener('change', async e => { pr.estado = e.target.value; await guardarPredio(pr, `Estado: ${ESTADOS[pr.estado]}`); toast('Estado actualizado.'); pintar(); });
  }

  function tabSismo(B) {
    const s = sismoEnSitio(S.mallas[pr.ciudad], pr.ubicacion);
    if (!s) { B.innerHTML = '<div class="card"><p class="sub">Falta la ubicación del predio (o queda fuera de la malla del ShakeMap).</p></div>'; return; }
    const nsr = nsrCiudad(pr.ciudad);
    const st = pr.analisisSismo || {};
    const o = { perfil: st.perfil || '', alturaM: st.alturaM || pr.vivienda.alturaM || (pr.vivienda.pisos || 1) * 2.7, sistema: st.sistemaPeriodo || (pr.vivienda.sistema === 'porticos' ? 'porticosConcreto' : 'otros'), T: st.T || 0, I: st.I || 1 };
    const d = demandaVsDiseno(s, nsr, { perfil: o.perfil, alturaM: o.alturaM, sistema: o.sistema, T: o.T, I: o.I });
    const m = textoMMI(s.mmi), liq = nivelFalla(s.licuacion), des = nivelFalla(s.deslizamiento);
    B.innerHTML = `<div class="datos">
      <div class="dato"><span>Intensidad (MMI)</span><b>${m.romano} · ${num(s.mmi)}</b><small>${esc(m.sacudida)}: ${esc(m.dano)}</small></div>
      <div class="dato"><span>PGA</span><b>${num(s.pga)} %g</b><small>aceleración máxima del suelo</small></div>
      <div class="dato"><span>PGV</span><b>${num(s.pgv)} cm/s</b><small>velocidad máxima</small></div>
      <div class="dato"><span>Vs30 de la malla</span><b>${num(s.vs30, 0)} m/s</b><small>estimado por pendiente</small></div>
      <div class="dato"><span>Licuación</span><b><span class="tag ${liq.clase === 'alta' ? 'rojo' : liq.clase === 'media' ? 'ambar' : 'verde'}">${esc(liq.nivel)}</span></b><small>${s.licuacion === null ? 'sin dato' : num(s.licuacion * 100, 1) + ' % (Zhu 2017)'}</small></div>
      <div class="dato"><span>Deslizamiento</span><b><span class="tag ${des.clase === 'alta' ? 'rojo' : des.clase === 'media' ? 'ambar' : 'verde'}">${esc(des.nivel)}</span></b><small>${s.deslizamiento === null ? 'sin dato' : num(s.deslizamiento * 100, 2) + ' % (Nowicki Jessee 2018)'}</small></div>
    </div>
    <div class="col2" style="margin-top:14px"><div class="card"><h3>Demanda del sismo contra el diseño NSR-10</h3>
      ${d.requiereEstudio ? '<p class="sub">Perfil F: requiere estudio de respuesta del sitio.</p>' : `${graficaEspectro(d, s)}
      <div class="datos" style="margin-top:10px"><div class="dato"><span>Sa diseño en T</span><b>${num(d.Sa, 3)} g</b></div><div class="dato"><span>PSA del sismo en T</span><b>${num(d.psa / 100, 3)} g</b></div><div class="dato"><span>Razón r</span><b style="color:${d.r >= 1 ? 'var(--rojo)' : d.r >= 0.5 ? 'var(--ambar)' : 'var(--verde)'}">${num(d.r, 2)}</b><small>PSA / Sa</small></div></div>
      <p class="sub" style="margin-top:10px">${esc(d.lectura)}</p>`}</div>
      <div class="card"><h3>Supuestos (editables)</h3><div class="pila" style="margin-top:8px">
        <label class="campo"><span>Perfil de suelo NSR-10 ${!o.perfil ? `(sugerido por Vs30: ${d.perfil})` : ''}</span><select id="perfil">${opciones(Object.entries(PERFILES), o.perfil, `Automático por Vs30 (${d.perfil})`)}</select></label>
        <label class="campo"><span>Sistema para el período (tabla A.4.2-1)</span><select id="sisT">${opciones(Object.entries(SISTEMAS_PERIODO).map(([k, v]) => [k, v.n]), o.sistema, null)}</select></label>
        <div class="formulario"><label class="campo"><span>Altura h (m)</span><input id="altT" type="number" step="0.1" value="${num(o.alturaM, 2).replace(',', '.')}"></label><label class="campo"><span>T conocido (s, opcional)</span><input id="Tman" type="number" step="0.01" value="${o.T || ''}"></label><label class="campo"><span>Importancia I</span><input id="Imp" type="number" step="0.05" value="${o.I}"></label></div>
        <div class="formula">Aa = ${nsr.Aa}  Av = ${nsr.Av}  ${nsr.verificado ? '' : '(por verificar)'}
Fa = ${d.Fa ?? '—'}  Fv = ${d.Fv ?? '—'}  (tablas A.2.4-3/4)
T = ${o.T ? 'manual' : `Ct·h^α = ${num(d.T, 3)} s`}
TC = 0,48·Av·Fv/(Aa·Fa) = ${num(d.TC, 3)} s   TL = 2,4·Fv = ${num(d.TL, 2)} s
Sa = ${d.T <= d.TC ? '2,5·Aa·Fa·I' : d.T <= d.TL ? '1,2·Av·Fv·I/T' : '1,2·Av·Fv·TL·I/T²'} = ${num(d.Sa, 3)} g
r = PSA(T)/Sa(T) = ${num(d.r, 2)}</div>
        <p class="tenue">${esc(nsr.fuente)}. PSA del ShakeMap v.${S.mallas[pr.ciudad]?.fuente?.shakemap || ''} (USGS, malla ~1 km). Es orientativo: no reemplaza el análisis estructural.</p>
      </div></div></div>`;
    const actualizar = async () => {
      pr.analisisSismo = { perfil: $('#perfil', B).value, sistemaPeriodo: $('#sisT', B).value, alturaM: +$('#altT', B).value || o.alturaM, T: +$('#Tman', B).value || 0, I: +$('#Imp', B).value || 1 };
      await guardarPredio(pr); tabSismo(B);
    };
    B.querySelectorAll('select, input').forEach(x => x.addEventListener('change', actualizar));
  }

  function mediciones(B) {
    B.innerHTML = `<div class="fila" style="margin-bottom:12px"><a class="btn pri" href="#/medir/grieta/${pr.id}">${ICON.regla} Medir una grieta</a><a class="btn" href="#/medir/inclinacion/${pr.id}">${ICON.nivel} Medir un desplome</a></div>
    <div class="rejilla dos">
      <div class="card"><h3>Grietas</h3>${pr.grietas.length ? pr.grietas.map((g, k) => {
        const u = g.ultima, cat = u ? categoriaBRE(u.anchoMm) : null;
        return `<div class="card" style="background:var(--panel2);margin-top:10px"><div class="fila entre"><b>Grieta ${k + 1} · ${esc(ELEMENTOS[g.elemento] || '')}</b>${g.lectura ? `<span class="tag ${g.lectura.nivel}">${g.lectura.nivel === 'alerta' ? 'Alerta' : g.lectura.nivel === 'revision' ? 'Revisión' : 'Sin señal grave'}</span>` : ''}</div>
          ${u ? `<div class="fila" style="margin-top:6px">${u.miniatura ? `<img src="${u.miniatura}" alt="" style="width:110px;border-radius:10px;border:1px solid var(--linea)">` : ''}<div><div class="resultado-grande" style="font-size:28px">${u.automatico?.noResuelta && !u.manual ? '≤ ' : ''}${num(u.anchoMm, 2)} <small>mm</small></div><span class="tenue">${esc(PATRONES[g.patron] || '')} · BRE ${cat.cat} (${esc(cat.n)}) · ${fechaCorta(u.fecha)}${u.manual ? ' · corregida a mano' : ''}</span></div></div>` : ''}
          ${(g.mediciones || []).length > 1 ? `<p class="sub" style="margin-top:6px">Historial: ${g.mediciones.map(m => `${num(m.anchoMm, 2)} mm (${fechaCorta(m.fecha)})`).join(' → ')}</p>` : ''}
          ${g.lectura?.razones?.length ? `<ul class="sub">${g.lectura.razones.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div>`;
      }).join('') : '<p class="sub">Sin grietas medidas.</p>'}</div>
      <div class="card"><h3>Desplomes</h3>${pr.inclinaciones.length ? `<table class="tabla"><tr><th>Elemento</th><th>Deriva</th><th>Desplome</th><th>Lectura</th></tr>${pr.inclinaciones.map(i => `<tr><td>${esc(i.elemento)}</td><td>${num(i.deriva, 2)} % ± ${num(i.incertidumbre, 2)}</td><td>${num(i.desplomeMm, 0)} mm / ${num(i.alturaM, 1)} m</td><td><span class="tag ${i.lectura.clase === 'alta' ? 'alerta' : i.lectura.clase === 'media' ? 'revision' : 'ok'}">${esc(i.lectura.n)}</span></td></tr>`).join('')}</table>` : '<p class="sub">Sin desplomes medidos.</p>'}</div>
    </div>`;
  }

  function fotos(B) {
    B.innerHTML = pr.fotos.length ? `<div class="fotos">${pr.fotos.map(f => `<a class="foto lista" href="${f.data}" target="_blank" rel="noopener"><img src="${f.data}" alt="${esc(f.tipo)}"><span class="ok">${esc(f.tipo)}</span></a>`).join('')}</div>` : `<div class="card vacio">Sin fotos. ${pr.origen === 'ciudadano' ? `<a href="#/reportar/${pr.id}">Agregar desde el reporte</a>` : ''}</div>`;
  }

  function tecnico(B) {
    const t = pr.topo, ob = pr.obra?.resumen;
    B.innerHTML = `<div class="rejilla">
      <div class="card"><h3>${ICON.casco} Evaluación fase 1</h3>${pr.evaluacionResumen?.cartel ? `<p><span class="tag" style="color:${CARTELES[pr.evaluacionResumen.cartel].color}">${esc(CARTELES[pr.evaluacionResumen.cartel].nombre)}</span></p><p class="tenue">${fechaCorta(pr.evaluacionResumen.fecha)} · ${esc(pr.evaluacionResumen.evaluador || '')}</p>` : '<p class="sub">Aún sin evaluación profesional.</p>'}
        ${pro ? `<a class="btn pri" href="#/pro/evaluar/${pr.id}">${pr.evaluacionId ? 'Abrir la evaluación' : 'Iniciar la evaluación'}</a>` : '<p class="tenue">La hace un profesional inscrito en el RUPE.</p>'}</div>
      <div class="card"><h3>${ICON.topo} Levantamiento del lote</h3>${t ? `<div class="datos"><div class="dato"><span>Área</span><b>${num(t.area, 1)} m²</b></div><div class="dato"><span>Perímetro</span><b>${num(t.perimetro, 1)} m</b></div><div class="dato"><span>Puntos</span><b>${t.puntos}</b></div></div><p class="tenue" style="margin-top:6px">Axiona Topo · ${fechaCorta(t.fecha)}</p>` : '<p class="sub">Linderos con GPS, cámara o cinta; niveles, curvas, corte y relleno. Al terminar, el resultado vuelve aquí solo.</p>'}
        ${pro ? `<button class="btn" id="topo">${t ? 'Abrir el levantamiento' : 'Medir el lote con Axiona Topo'}</button>` : ''}</div>
      <div class="card"><h3>${ICON.plano} Diseño, planos y presupuesto</h3>${ob ? `<div class="datos"><div class="dato"><span>Lote</span><b>${num(ob.loteM2, 1)} m²</b></div><div class="dato"><span>Construido</span><b>${num(ob.construidoM2, 1)} m²</b></div><div class="dato"><span>Presupuesto</span><b>${pesos(ob.total)}</b><small>${esc(ob.moneda || '')}</small></div></div><p class="tenue" style="margin-top:6px">Axiona Obra · ${fechaCorta(ob.fecha)}</p>` : `<p class="sub">Reforzamiento o reconstrucción con planos (PDF, DXF, DWG, IFC), 3D y presupuesto. ${t ? 'Se usa el lote medido con Topo.' : 'Sin levantamiento se parte de un lote rectangular (frente × fondo).'}</p>`}
        ${pro ? `${!t && !pr.obra ? `<div class="formulario" style="margin:8px 0"><label class="campo"><span>Frente (m)</span><input id="frente" type="number" value="8" step="0.1"></label><label class="campo"><span>Fondo (m)</span><input id="fondo" type="number" value="15" step="0.1"></label></div>` : ''}<button class="btn" id="obra">${ob ? 'Abrir el diseño en Axiona Obra' : 'Diseñar en Axiona Obra'}</button>` : ''}</div>
    </div>`;
    $('#topo', B)?.addEventListener('click', () => abrirTopo(pr));
    $('#obra', B)?.addEventListener('click', () => abrirObra(pr, { frente: +$('#frente', B)?.value || 8, fondo: +$('#fondo', B)?.value || 15 }));
  }

  function documentos(B) {
    B.innerHTML = `<div class="rejilla">
      <div class="card"><h3>${ICON.doc} Expediente PDF</h3><p class="sub">Ubicación, sismo en el sitio, señales, mediciones con su método, fotos, evaluación, levantamiento, diseño y derechos.</p><button class="btn pri" id="pdf2">${ICON.descargar} Descargar</button></div>
      <div class="card"><h3>${ICON.balanza} Derecho de petición</h3><p class="sub">Redactado con los datos del expediente; usted lo revisa y lo edita.</p><a class="btn" href="#/derechos/${pr.id}?p=peticion">Redactar</a></div>
      <div class="card"><h3>${ICON.whatsapp} Compartir el estado</h3><p class="sub">Un mensaje con el código y el estado del caso, para enviar por WhatsApp.</p><button class="btn" id="wa">Compartir</button></div>
      ${!pr.demo && pr.origen === 'ciudadano' ? `<div class="card"><h3>${ICON.x} Borrar mis datos</h3><p class="sub">Elimina este expediente del teléfono (Ley 1581). Si ya lo envió, pida también la supresión a la alcaldía.</p><button class="btn peligro" id="borrar">Borrar</button></div>` : ''}
    </div>`;
    $('#pdf2', B).onclick = async () => { const { pdfExpediente } = await import('../expediente/pdf.js'); await pdfExpediente(pr); };
    $('#wa', B).onclick = () => {
      const t = `AXIONA EVALÚA · ${pr.id}\n${pr.ubicacion.direccion || ''} (${C.nombre})\nEstado: ${ESTADOS[pr.estado]}\nOrientación: ${pr.orientacion?.t || ''}\n${pr.grietas.length ? `Grieta más ancha: ${Math.max(...pr.grietas.filter(g => g.ultima).map(g => g.ultima.anchoMm), 0)} mm\n` : ''}`;
      if (navigator.share) navigator.share({ text: t }).catch(() => {}); else window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener');
    };
    $('#borrar', B)?.addEventListener('click', async () => { if (await confirmar('Borrar este expediente', 'Se eliminan del teléfono sus datos, fotos y mediciones. No se puede deshacer.', { si: 'Borrar', peligro: true })) { await borrarPredio(pr.id); try { localStorage.removeItem('axiona-puente:' + pr.id); } catch { /* */ } toast('Expediente borrado.'); location.hash = '#/micasa'; } });
  }

  function historial(B) {
    B.innerHTML = `<div class="card"><table class="tabla"><tr><th>Fecha</th><th>Evento</th><th>Por</th></tr>${[...(pr.historial || [])].reverse().map(h => `<tr><td>${fechaHora(h.fecha)}</td><td>${esc(h.evento)}</td><td>${esc(h.por || '')}</td></tr>`).join('')}</table></div>`;
  }

  pintar();
}

export { distancia };
