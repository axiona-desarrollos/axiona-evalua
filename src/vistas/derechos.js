// Mis derechos: guía paso a paso (motor determinista), preguntas con citas (Claude) y derecho de petición.
import { $, esc, ICON, toast, modal, opciones, descargarBlob } from '../ui/base.js';
import { S, guardarPredio } from '../nucleo/estado.js';
import { CIUDADES } from '../nucleo/ciudades.js';
import { analizar } from '../derechos/motor.js';
import { CORPUS, ficha, CORTE_CORPUS } from '../derechos/corpus.js';
import { redactarPeticion, PETICIONES } from '../derechos/peticion.js';
import { preguntarDerechos } from '../nucleo/red.js';
import { textoFecha, hoyColombia } from '../nucleo/calendario.js';

const ROLES = [['propietario', 'Soy propietario(a)'], ['arrendatario', 'Vivo en arriendo'], ['arrendador', 'Arriendo una vivienda a otros'], ['ph', 'Vivo en edificio o conjunto (propiedad horizontal)'], ['poseedor', 'Vivo ahí pero no tengo escrituras']];
const ESTADOS_V = [['destruida', 'Destruida'], ['no_habitable', 'No se puede habitar'], ['averiada', 'Dañada pero habitable'], ['sin_dano', 'Sin daño aparente']];

export async function render(main, id) {
  const pr = id ? S.predios.get(id) : null;
  const C = CIUDADES[pr?.ciudad || S.ciudad];
  const base = pr?.derechos?.situacion || {};
  const s = {
    rol: base.rol || (pr ? ({ propia: 'propietario', arriendo: 'arrendatario', poseedor: 'poseedor' }[pr.hogar.tenencia] || (pr.vivienda.ph ? 'ph' : '')) : ''),
    estado: base.estado || (pr?.orientacion?.nivel === 'alerta' ? 'no_habitable' : ''), enRUD: base.enRUD || 'nose', desalojo: !!base.desalojo, contratoVence: base.contratoVence || '',
    ultimoCanon: base.ultimoCanon || '', ipc: base.ipc || S.ajustes.ipc || '', valorComercial: base.valorComercial || '',
    vulnerables: base.vulnerables ?? !!(pr && (+pr.hogar.menores || +pr.hogar.mayores || +pr.hogar.discapacidad || +pr.hogar.gestantes)), negaronAyuda: !!base.negaronAyuda, necesitaLicencia: !!base.necesitaLicencia, ph: base.ph ?? !!pr?.vivienda?.ph,
  };
  let pestana = location.hash.includes('p=peticion') ? 'peticion' : 'guia';
  let resultado = null;

  const verCita = idc => {
    const f = ficha(idc); if (!f) return;
    modal(`<span class="tenue">${esc(f.norma)} · ${esc(f.art)}</span><h3 style="margin-top:4px">${esc(f.titulo)}</h3><p>${esc(f.texto)}</p>${f.notas ? `<div class="aviso ambar">${ICON.info}<span>${esc(f.notas)}</span></div>` : ''}
      <p class="tenue" style="margin-top:10px">Resumen elaborado por Axiona, no es el texto oficial · ${f.estado === 'revisado' ? 'revisado por abogado' : 'pendiente de revisión jurídica'} · <a href="${esc(f.fuente)}" target="_blank" rel="noopener">fuente</a></p>`);
  };
  const chips = ids => ids.map(c => { const f = ficha(c); return f ? `<span class="cita" data-cita="${c}">${esc(f.norma.replace(' de 2026', ' /26'))}${f.art.startsWith('art') ? ', ' + esc(f.art) : ''}</span>` : ''; }).join('');

  function pintar() {
    main.innerHTML = `<div class="cabecera"><div><h1>Mis derechos</h1><p class="sub">Sismo del 10 de agosto de 2026 · ${esc(C.nombre)}${pr ? ` · expediente <a href="#/expediente/${pr.id}">${esc(pr.id)}</a>` : ''}</p></div></div>
      <div class="aviso" style="margin:10px 0">${ICON.info}<span>Información jurídica general, no asesoría. Corpus curado de ${CORPUS.length} fichas al ${esc(textoFecha(new Date(CORTE_CORPUS + 'T12:00:00Z'), false))}, pendiente de revisión por un consultorio jurídico aliado. Las fechas límite las calcula la app, con festivos de Colombia.</span></div>
      <div class="pestanas"><button data-t="guia" aria-selected="${pestana === 'guia'}">${ICON.lista} Guía paso a paso</button><button data-t="pregunta" aria-selected="${pestana === 'pregunta'}">${ICON.chispa} Preguntar</button><button data-t="peticion" aria-selected="${pestana === 'peticion'}">${ICON.doc} Derecho de petición</button></div>
      <div id="cuerpo"></div>`;
    $('.pestanas', main).onclick = e => { const b = e.target.closest('[data-t]'); if (b) { pestana = b.dataset.t; pintar(); } };
    ({ guia, pregunta, peticion })[pestana]($('#cuerpo', main));
  }

  function guia(B) {
    B.innerHTML = `<div class="col2"><div class="card"><h3>Su situación</h3><div class="pila" style="margin-top:8px">
      <label class="campo"><span>¿Cuál es su relación con la vivienda?</span><select data-k="rol">${opciones(ROLES, s.rol)}</select></label>
      <label class="campo"><span>¿Cómo quedó la vivienda?</span><select data-k="estado">${opciones(ESTADOS_V, s.estado)}</select></label>
      <label class="campo"><span>¿Quedó en el Registro Único de Damnificados (RUD)?</span><select data-k="enRUD">${opciones([['si', 'Sí'], ['no', 'No'], ['nose', 'No sé']], s.enRUD, null)}</select></label>
      ${['arrendatario', 'arrendador'].includes(s.rol) ? `<div class="formulario"><label class="campo"><span>Fecha en que vence el contrato</span><input type="date" data-k="contratoVence" value="${esc(s.contratoVence)}"></label>
        <label class="campo"><span>Último canon ($)</span><input type="number" data-k="ultimoCanon" value="${esc(s.ultimoCanon)}"></label>
        <label class="campo"><span>IPC aplicable (%) · <a href="https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc" target="_blank" rel="noopener">DANE</a></span><input type="number" step="0.01" data-k="ipc" value="${esc(s.ipc)}" placeholder="Escriba el IPC oficial"></label>
        <label class="campo"><span>Valor comercial del inmueble ($, opcional)</span><input type="number" data-k="valorComercial" value="${esc(s.valorComercial)}"></label></div>` : ''}
      <div class="chequeos">${[['desalojo', 'Me están desalojando o me amenazan con desalojarme'], ['vulnerables', 'En el hogar hay niños, mayores, personas con discapacidad o gestantes'], ['negaronAyuda', 'Me negaron una ayuda o un subsidio'], ['necesitaLicencia', 'Necesito reparar, reforzar, demoler o reconstruir'], ['ph', 'Es un edificio o conjunto con administración']].map(([k, t]) => `<label class="chequeo"><input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}><span><b>${t}</b></span></label>`).join('')}</div>
    </div></div><div id="res" class="pila"></div></div>`;
    const calcular = async () => {
      resultado = analizar({ ...s, ultimoCanon: +s.ultimoCanon || null, ipc: s.ipc === '' ? null : +s.ipc, valorComercial: +s.valorComercial || null }, { fechas: S.ajustes.fechas });
      const R = $('#res', B);
      R.innerHTML = `${resultado.escalar ? `<div class="nivel alerta"><h3>${ICON.alerta} Busque asesoría gratuita hoy</h3><ul>${resultado.motivosEscalamiento.map(m => `<li>${esc(m)}</li>`).join('')}</ul><p class="sub" style="margin-top:6px">En ${esc(C.nombre)}:</p><ul>${C.entidades.filter(e => ['consultorio', 'personeria', 'defensoria'].includes(e.tipo)).map(e => `<li>${esc(e.n)} <span class="tenue">· ${esc(e.nota)}${e.verificado ? '' : ' · datos de contacto por confirmar'}</span></li>`).join('')}</ul></div>` : ''}
        ${resultado.derechos.map(d => `<div class="card"><div class="fila entre"><h3>${esc(d.titulo)}</h3>${d.plazo ? `<span class="tag ${d.plazo.vencido ? 'rojo' : 'acento'}">${esc(d.plazo.texto)}</span>` : ''}</div>
          <p>${esc(d.texto)}</p>${d.calculo ? `<div class="formula">${esc(d.calculo.formula)}\n= ${d.calculo.ultimoCanon.toLocaleString('es-CO')} × (1 + ${d.calculo.ipc}/100) = ${d.calculo.tope.toLocaleString('es-CO')}</div>` : ''}
          ${d.acciones.length ? `<ul class="sub">${d.acciones.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}<div>${chips(d.citas)}</div></div>`).join('')}
        <div class="card"><h3>Para qué sirve cada entidad</h3><table class="tabla">${C.entidades.map(e => `<tr><td><b>${esc(e.n)}</b></td><td class="sub">${esc(e.nota)}</td></tr>`).join('')}</table><p class="tenue" style="margin-top:6px">Los datos de contacto se confirman con cada entidad antes del lanzamiento.</p></div>`;
      if (pr) { pr.derechos = { situacion: { ...s }, fecha: new Date().toISOString(), ids: resultado.derechos.map(d => d.id) }; await guardarPredio(pr); }
    };
    B.addEventListener('change', e => {
      const k = e.target.dataset.k; if (!k) return;
      s[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (k === 'ipc') { S.ajustes.ipc = s.ipc; }
      if (k === 'rol') { guia(B); return; }
      calcular();
    });
    calcular();
  }

  function pregunta(B) {
    B.innerHTML = `<div class="col2"><div class="card"><h3>Pregunte con sus palabras</h3><p class="sub">La respuesta sale solo de las fichas de normas del sismo y cita cada una. Si no hay base, se lo dice y le indica a quién acudir.</p>
      <textarea id="q" placeholder="Ej.: Mi contrato de arriendo vence en diciembre y el dueño me quiere subir el canon. ¿Qué puedo hacer?"></textarea>
      <div class="fila" style="margin-top:8px">${['¿Me pueden desalojar si la casa quedó dañada?', 'No quedé en el RUD, ¿qué hago?', '¿Cómo pido la licencia para reforzar mi edificio?'].map(t => `<button class="btn sm" data-ej="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <button class="btn pri bloque" id="preguntar" style="margin-top:10px">${ICON.enviar} Preguntar</button></div><div id="resp" class="pila"></div></div>`;
    B.addEventListener('click', e => { const b = e.target.closest('[data-ej]'); if (b) $('#q', B).value = b.dataset.ej; });
    $('#preguntar', B).onclick = async () => {
      const q = $('#q', B).value.trim(); if (q.length < 5) return toast('Escriba su pregunta.');
      const R = $('#resp', B);
      if (!navigator.onLine) { R.innerHTML = `<div class="aviso ambar">${ICON.info}<span>Sin señal. Use la guía paso a paso, que funciona sin internet.</span></div>`; return; }
      R.innerHTML = '<div class="card"><span class="cargando"></span> Buscando en las normas…</div>';
      const ctx = resultado ? resultado.derechos.map(d => `${d.titulo}: ${d.plazo?.texto || ''}`).join('; ') : '';
      try {
        const d = await preguntarDerechos(q, `Ciudad: ${C.nombre}. Hoy: ${textoFecha(hoyColombia(), false)}. ${ctx}`);
        R.innerHTML = `<div class="card">${d.partes.map(p => `<span>${esc(p.texto).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</span>${p.citas.length ? ' ' + chips(p.citas) : ''}`).join('')}
          ${d.conCitas ? '' : `<div class="aviso ambar" style="margin-top:10px">${ICON.info}<span>Esta respuesta no trae citas: tómela con cautela y consulte el consultorio jurídico.</span></div>`}
          <p class="tenue" style="margin-top:10px">Información general, no asesoría · ${esc(d.modelo)}</p></div>`;
      } catch (e) { R.innerHTML = `<div class="aviso ambar">${ICON.info}<span>${esc(e.message)} Use la guía paso a paso.</span></div>`; }
    };
  }

  function peticion(B) {
    const d = { ciudad: C.nombre, entidad: C.entidades[0].n.split(' · ')[0], nombre: pr?.contacto.nombre || '', documento: pr?.contacto.documento || '', telefono: pr?.contacto.telefono || '', correo: pr?.contacto.correo || '', direccion: pr?.ubicacion.direccion || '', barrio: pr?.ubicacion.barrio || '', peticiones: ['evaluacion'] };
    const texto = () => redactarPeticion(d, pr || {});
    B.innerHTML = `<div class="col2"><div class="card"><h3>Datos</h3><div class="pila" style="margin-top:8px">
      <label class="campo"><span>Dirigida a</span><select data-d="entidad">${opciones(C.entidades.map(e => [e.n, e.n]), d.entidad, 'Alcaldía de ' + C.nombre)}</select></label>
      <div class="formulario">${[['nombre', 'Nombre'], ['documento', 'Cédula'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['direccion', 'Dirección']].map(([k, t]) => `<label class="campo"><span>${t}</span><input data-d="${k}" value="${esc(d[k])}"></label>`).join('')}</div>
      <p class="sub">¿Qué pide?</p><div class="chequeos">${Object.entries(PETICIONES).map(([k, t]) => `<label class="chequeo"><input type="checkbox" data-p="${k}" ${d.peticiones.includes(k) ? 'checked' : ''}><span><small>${esc(t)}</small></span></label>`).join('')}</div>
    </div></div><div class="card"><h3>Texto (puede editarlo)</h3><textarea id="txt" style="min-height:520px;font-size:13.5px">${esc(texto())}</textarea>
      <div class="fila" style="margin-top:8px"><button class="btn pri" id="copiar">Copiar</button><button class="btn" id="bajar">${ICON.descargar} Descargar</button><button class="btn" id="pdfP">${ICON.imprimir} PDF</button></div>
      <p class="tenue" style="margin-top:8px">Radíquela en la entidad o por su correo oficial y guarde el número de radicado: desde ese día corren los 15 días hábiles.</p></div></div>`;
    const re = () => { $('#txt', B).value = texto(); };
    B.addEventListener('change', e => {
      if (e.target.dataset.d) { d[e.target.dataset.d] = e.target.value; re(); }
      if (e.target.dataset.p) { d.peticiones = Object.keys(PETICIONES).filter(k => B.querySelector(`[data-p="${k}"]`).checked); re(); }
    });
    $('#copiar', B).onclick = async () => { try { await navigator.clipboard.writeText($('#txt', B).value); toast('Copiado.'); } catch { toast('No se pudo copiar.'); } };
    $('#bajar', B).onclick = () => descargarBlob(`peticion-${pr?.id || 'axiona'}.txt`, new Blob([$('#txt', B).value], { type: 'text/plain;charset=utf-8' }));
    $('#pdfP', B).onclick = async () => {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'letter' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      const lineas = doc.splitTextToSize($('#txt', B).value, 176);
      let y = 22;
      for (const l of lineas) { if (y > 262) { doc.addPage(); y = 22; } doc.text(l, 20, y); y += 5.6; }
      descargarBlob(`peticion-${pr?.id || 'axiona'}.pdf`, doc.output('blob'));
    };
  }

  main.addEventListener('click', e => { const c = e.target.closest('[data-cita]'); if (c) verCita(c.dataset.cita); });
  pintar();
}
