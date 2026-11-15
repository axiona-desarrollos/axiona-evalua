// Reporte guiado del ciudadano: ubicación → señales → fotos → vivienda y hogar → contacto → resultado.
import { $, esc, ICON, toast, barraPasos, opciones } from '../ui/base.js';
import { S, guardarPredio, cargarMalla, guardarGeneral } from '../nucleo/estado.js';
import { nuevoPredio, faltantesSolicitud, anotar } from '../nucleo/predio.js';
import { CIUDADES, ciudadDe } from '../nucleo/ciudades.js';
import { SENALES } from '../medir/orientacion.js';
import { prepararFoto, ubicar } from '../ui/medios.js';
import { coordTexto } from '../nucleo/geo.js';
import { enviarPendientes } from '../nucleo/sync.js';

const PASOS = ['Ubicación', 'Señales', 'Fotos', 'Vivienda', 'Contacto', 'Resultado'];
export const SISTEMAS_SIMPLES = [
  ['noReforzada', 'Ladrillo o bloque SIN columnas de concreto'],
  ['confinada', 'Ladrillo o bloque CON columnas y vigas de concreto'],
  ['porticos', 'Estructura de columnas y vigas de concreto (edificio)'],
  ['madera', 'Madera'], ['palafito', 'Palafito (madera sobre pilotes)'], ['bahareque', 'Bahareque (tierra y guadua o madera)'],
  ['mixto', 'Mixta / otra'], ['', 'No sé'],
];
const FOTOS = [
  { tipo: 'fachada', t: 'Fachada', d: 'Toda la casa de frente', req: true },
  { tipo: 'danio', t: 'Daño principal', d: 'De cerca, con una mano o lapicero de referencia' },
  { tipo: 'lateral', t: 'Costado o atrás', d: 'Muestra si la casa está inclinada' },
  { tipo: 'interior', t: 'Adentro', d: 'Solo si es seguro entrar' },
  { tipo: 'extra', t: 'Otra', d: 'Terreno, vecinos, techo' },
];

export async function render(main, idParam) {
  let pr = idParam ? S.predios.get(idParam) : null;
  if (!pr) { pr = nuevoPredio(S.ciudad, 'ciudadano'); await guardarPredio(pr); history.replaceState(null, '', `#/reportar/${pr.id}`); }
  let paso = pr.pasoReporte || 0;
  let mapa = null;

  const guardar = async () => { pr.pasoReporte = paso; await guardarPredio(pr); };

  async function pintar() {
    if (mapa) { mapa.remove(); mapa = null; }
    main.innerHTML = `<div class="cabecera"><div><h1>Reportar mi casa</h1><p class="sub">${esc(CIUDADES[pr.ciudad].nombre)} · código <span class="mono">${esc(pr.id)}</span> · se guarda solo</p></div></div>
      ${barraPasos(PASOS, paso)}<div id="paso"></div>
      <div class="fila entre" style="margin-top:18px">${paso > 0 && paso < 5 ? `<button class="btn" id="atras">${ICON.atras} Atrás</button>` : '<span></span>'}${paso < 5 ? `<button class="btn pri grande" id="sigue">${paso === 4 ? 'Ver resultado' : 'Siguiente'} ${ICON.flecha}</button>` : ''}</div>`;
    const P = $('#paso', main);
    await [pasoUbicacion, pasoSenales, pasoFotos, pasoVivienda, pasoContacto, pasoResultado][paso](P);
    $('#atras', main)?.addEventListener('click', async () => { paso--; await guardar(); pintar(); });
    $('#sigue', main)?.addEventListener('click', async () => {
      const err = validar();
      if (err) return toast(err, 3200, 'error');
      paso++; await guardar(); pintar();
    });
  }

  function validar() {
    if (paso === 0 && pr.ubicacion.lat === null) return 'Marque la ubicación: toque el mapa o use el GPS.';
    if (paso === 0 && !pr.ubicacion.direccion.trim()) return 'Escriba la dirección o una referencia para encontrar la casa.';
    if (paso === 2 && !pr.fotos.some(f => f.tipo === 'fachada')) return 'La foto de la fachada es necesaria.';
    if (paso === 4 && !pr.contacto.consentimiento) return 'Para enviar el reporte se necesita su autorización de tratamiento de datos.';
    if (paso === 4 && (!pr.contacto.nombre.trim() || !pr.contacto.telefono.trim())) return 'Escriba su nombre y un teléfono o WhatsApp.';
    return null;
  }

  async function pasoUbicacion(P) {
    P.innerHTML = `<div class="col2"><div class="card"><h2>¿Dónde está la vivienda?</h2><p class="sub">Toque el mapa sobre la casa o use el GPS estando en ella. Puede arrastrar el marcador.</p>
      <div id="mapaU" class="mapa bajo" style="margin:10px 0"></div>
      <div class="fila"><button class="btn" id="gps">${ICON.ubicacion} Usar mi ubicación (GPS)</button><span class="tenue" id="coords">${pr.ubicacion.lat !== null ? esc(coordTexto(pr.ubicacion)) + (pr.ubicacion.precision ? ` · ±${pr.ubicacion.precision} m` : '') : 'Sin ubicación todavía'}</span></div></div>
      <div class="card"><h3>Dirección</h3><div class="pila" style="margin-top:8px">
        <label class="campo"><span>Dirección o cómo llegar *</span><input id="dir" value="${esc(pr.ubicacion.direccion)}" placeholder="Ej.: Carrera 4 # 24-15, o 'detrás de la iglesia'"></label>
        <label class="campo"><span>Barrio</span><input id="barrio" value="${esc(pr.ubicacion.barrio)}"></label>
        <label class="campo"><span>Punto de referencia</span><input id="ref" value="${esc(pr.ubicacion.referencia)}" placeholder="Casa azul de dos pisos, portón negro…"></label>
        <label class="campo"><span>Número predial (si lo tiene en el recibo del predial)</span><input id="predial" value="${esc(pr.ubicacion.numeroPredial)}" inputmode="numeric"></label>
      </div></div></div>`;
    const marcar = async (lat, lon, extra = {}) => {
      pr.ubicacion = { ...pr.ubicacion, lat: +(+lat).toFixed(6), lon: +(+lon).toFixed(6), ...extra };
      const c = ciudadDe(pr.ubicacion);
      if (c && c.id !== pr.ciudad) { pr.ciudad = c.id; S.ciudad = c.id; guardarGeneral(); toast(`La ubicación queda en ${c.nombre}: se cambia la ciudad.`); }
      $('#coords', P).textContent = coordTexto(pr.ubicacion) + (pr.ubicacion.precision ? ` · ±${pr.ubicacion.precision} m` : '');
      await guardar();
    };
    try {
      const { crearMapa } = await import('../mapa/mapa.js');
      mapa = await crearMapa($('#mapaU', P), { ciudad: pr.ciudad, centro: pr.ubicacion.lat !== null ? pr.ubicacion : null, zoom: pr.ubicacion.lat !== null ? 16.5 : undefined, sismo: false, ubicarme: false, alElegir: ll => marcar(ll.lat, ll.lng, { gps: false, precision: null }) });
      if (pr.ubicacion.lat !== null) mapa.ponerMarca(pr.ubicacion.lat, pr.ubicacion.lon);
    } catch (e) { $('#mapaU', P).innerHTML = `<div class="vacio">Mapa no disponible (${esc(e.message)}). Use el GPS.</div>`; }
    $('#gps', P).onclick = async () => {
      const b = $('#gps', P); b.disabled = true; b.innerHTML = '<span class="cargando"></span> Buscando señal GPS…';
      try {
        const u = await ubicar();
        await marcar(u.lat, u.lon, { gps: true, precision: u.precision });
        mapa?.ponerMarca(u.lat, u.lon); mapa?.flyTo({ center: [u.lon, u.lat], zoom: 17 });
        toast(`Ubicación tomada (±${u.precision} m).`);
      } catch (e) { toast(e.message, 4000, 'error'); }
      b.disabled = false; b.innerHTML = `${ICON.ubicacion} Usar mi ubicación (GPS)`;
    };
    for (const [id, k] of [['dir', 'direccion'], ['barrio', 'barrio'], ['ref', 'referencia'], ['predial', 'numeroPredial']]) $('#' + id, P).addEventListener('change', e => { pr.ubicacion[k] = e.target.value.trim(); guardar(); });
  }

  async function pasoSenales(P) {
    P.innerHTML = `<div class="card"><h2>¿Qué ve en la casa?</h2><p class="sub">Marque todo lo que aplique. Si no está seguro, márquelo: es mejor que lo revise un profesional.</p>
      <div class="chequeos" style="margin-top:10px">${SENALES.map(x => `<label class="chequeo ${x.grave ? 'grave' : ''}"><input type="checkbox" data-s="${x.id}" ${pr.senales[x.id] ? 'checked' : ''}><span><b>${esc(x.t)}</b>${x.grave ? '<small>Señal grave</small>' : ''}</span></label>`).join('')}</div>
      <div id="urgente" style="margin-top:12px"></div></div>`;
    const avisar = () => {
      const graves = SENALES.filter(x => x.grave && pr.senales[x.id]);
      $('#urgente', P).innerHTML = graves.length ? `<div class="nivel alerta"><h3>${ICON.alerta} Salga de la casa y aléjese de muros y fachadas</h3><ul>${pr.senales.gas ? '<li>Cierre el registro del gas, no prenda luces ni fósforos. Llame al 123.</li>' : ''}<li>No vuelva a entrar hasta que un profesional la evalúe.</li><li>Termine el reporte: su caso queda con prioridad.</li></ul></div>` : '';
    };
    P.addEventListener('change', e => { const k = e.target.dataset.s; if (!k) return; pr.senales[k] = e.target.checked; if (!e.target.checked) delete pr.senales[k]; avisar(); guardar(); });
    avisar();
  }

  async function pasoFotos(P) {
    const pintarFotos = () => {
      $('#fotos', P).innerHTML = FOTOS.map(f => {
        const ya = pr.fotos.find(x => x.tipo === f.tipo);
        return `<label class="foto ${ya ? 'lista' : ''}">${ya ? `<img src="${ya.data}" alt=""><span class="ok">✓</span>` : `${ICON.camara}<b>${esc(f.t)}${f.req ? ' *' : ''}</b><small>${esc(f.d)}</small>`}<input type="file" accept="image/*" capture="environment" data-tipo="${f.tipo}" hidden></label>`;
      }).join('');
    };
    P.innerHTML = `<div class="card"><h2>Fotos de la vivienda</h2><p class="sub">Desde afuera si hay peligro. Cada foto queda con fecha, hora y coordenadas.</p><div class="fotos" id="fotos" style="margin-top:10px"></div>
      <p class="tenue" style="margin-top:10px">Para medir el ancho de una grieta en milímetros use «Medir grieta» en el resultado (necesita la tarjeta-regla).</p></div>`;
    pintarFotos();
    P.addEventListener('change', async e => {
      const inp = e.target.closest('input[type=file]'); if (!inp?.files?.[0]) return;
      const sello = `${new Date().toLocaleString('es-CO')} · ${pr.ubicacion.lat !== null ? coordTexto(pr.ubicacion) : ''} · ${pr.id}`;
      const data = await prepararFoto(inp.files[0], sello);
      pr.fotos = pr.fotos.filter(x => x.tipo !== inp.dataset.tipo);
      pr.fotos.push({ id: `${inp.dataset.tipo}-${Date.now().toString(36)}`, tipo: inp.dataset.tipo, data, fecha: new Date().toISOString() });
      await guardar(); pintarFotos();
    });
  }

  async function pasoVivienda(P) {
    const v = pr.vivienda, h = pr.hogar;
    P.innerHTML = `<div class="col2"><div class="card"><h2>La vivienda</h2><div class="pila" style="margin-top:8px">
      <label class="campo"><span>¿De qué está hecha?</span><select id="sistema">${opciones(SISTEMAS_SIMPLES.filter(([k]) => k), v.sistema, 'No sé')}</select></label>
      <div class="formulario"><label class="campo"><span>Pisos</span><input id="pisos" type="number" min="1" max="30" value="${esc(v.pisos)}"></label>
      <label class="campo"><span>Altura aprox. (m)</span><input id="altura" type="number" min="2" step="0.1" value="${esc(v.alturaM)}" placeholder="${(+v.pisos || 1) * 2.7}"></label></div>
      <label class="chequeo"><input type="checkbox" id="ph" ${v.ph ? 'checked' : ''}><span><b>Es un edificio o conjunto con administración</b><small>Propiedad horizontal</small></span></label>
      <label class="campo"><span>Usted es…</span><select id="tenencia">${opciones([['propia', 'Propietario(a)'], ['arriendo', 'Arrendatario(a)'], ['familiar', 'Vive en casa de un familiar'], ['poseedor', 'Poseedor(a) sin escrituras'], ['otra', 'Otra']], h.tenencia)}</select></label>
    </div></div>
    <div class="card"><h2>El hogar</h2><p class="sub">Ayuda a priorizar a quienes más lo necesitan.</p><div class="formulario" style="margin-top:8px">
      ${[['personas', 'Personas que viven'], ['menores', 'Menores de 18'], ['mayores', 'Mayores de 60'], ['discapacidad', 'Con discapacidad'], ['gestantes', 'Mujeres gestantes']].map(([k, t]) => `<label class="campo"><span>${t}</span><input type="number" min="0" max="40" data-h="${k}" value="${esc(h[k])}"></label>`).join('')}
    </div></div></div>`;
    P.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.h) pr.hogar[t.dataset.h] = t.value === '' ? '' : +t.value;
      else if (t.id === 'sistema') pr.vivienda.sistema = t.value;
      else if (t.id === 'pisos') pr.vivienda.pisos = +t.value || 1;
      else if (t.id === 'altura') pr.vivienda.alturaM = t.value === '' ? '' : +t.value;
      else if (t.id === 'ph') pr.vivienda.ph = t.checked;
      else if (t.id === 'tenencia') pr.hogar.tenencia = t.value;
      guardar();
    });
  }

  async function pasoContacto(P) {
    const c = pr.contacto;
    P.innerHTML = `<div class="col2"><div class="card"><h2>¿Cómo lo contactamos?</h2><div class="pila" style="margin-top:8px">
      <label class="campo"><span>Nombre completo *</span><input id="nombre" value="${esc(c.nombre)}" autocomplete="name"></label>
      <label class="campo"><span>Teléfono o WhatsApp *</span><input id="tel" value="${esc(c.telefono)}" inputmode="tel" autocomplete="tel"></label>
      <label class="campo"><span>Cédula (opcional; sirve para la petición y el RUD)</span><input id="doc" value="${esc(c.documento)}" inputmode="numeric"></label>
      <label class="campo"><span>Correo (opcional)</span><input id="correo" value="${esc(c.correo)}" type="email" autocomplete="email"></label>
    </div></div>
    <div class="card"><h2>Autorización de datos</h2>
      <p class="sub">Ley 1581 de 2012. Sus datos y fotos se usan solo para gestionar la evaluación de su vivienda, priorizar la atención y orientarle sobre sus derechos. Pueden compartirse con la alcaldía y los evaluadores que atiendan su caso. Puede conocerlos, corregirlos o pedir que se borren en cualquier momento. No se venden ni se usan para publicidad.</p>
      <label class="chequeo" style="margin-top:8px"><input type="checkbox" id="cons" ${c.consentimiento ? 'checked' : ''}><span><b>Autorizo el tratamiento de mis datos para estos fines *</b></span></label></div></div>`;
    P.addEventListener('change', e => {
      const t = e.target, m = { nombre: 'nombre', tel: 'telefono', doc: 'documento', correo: 'correo' };
      if (m[t.id]) pr.contacto[m[t.id]] = t.value.trim();
      if (t.id === 'cons') pr.contacto.consentimiento = t.checked;
      guardar();
    });
  }

  async function pasoResultado(P) {
    await cargarMalla(pr.ciudad);
    if (pr.estado === 'borrador') { pr.estado = 'reportado'; anotar(pr, 'Reporte completado por el ciudadano', 'ciudadano'); }
    await guardar();
    const o = pr.orientacion, falta = faltantesSolicitud(pr);
    P.innerHTML = `<div class="col2"><div class="pila">
      <div class="nivel ${o.clase}"><h3>${o.nivel === 'alerta' ? ICON.alerta : o.nivel === 'revision' ? ICON.info : ICON.ok} ${esc(o.t)}</h3><p>${esc(o.d)}</p>
        ${o.razones.length ? `<ul>${o.razones.slice(0, 6).map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
        ${o.acciones.length ? `<p style="margin-top:6px"><b>Haga esto ahora:</b></p><ul>${o.acciones.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}</div>
      <div class="card"><h3>Mida para documentar mejor (opcional)</h3><p class="sub">Con medidas reales su caso se prioriza mejor y queda evidencia para comparar si la grieta crece con una réplica.</p>
        <div class="fila" style="margin-top:8px"><a class="btn" href="#/medir/grieta/${pr.id}">${ICON.regla} Medir una grieta</a><a class="btn" href="#/medir/inclinacion/${pr.id}">${ICON.nivel} Medir si un muro está inclinado</a></div></div>
    </div>
    <div class="pila">
      <div class="card borde"><h3>${ICON.enviar} Pedir la evaluación profesional</h3>
        ${pr.solicitudEnviada ? `<p class="sub">${pr.sincronizado ? `Solicitud recibida. Código <b class="mono">${esc(pr.id)}</b>.` : 'Solicitud guardada: se enviará sola cuando haya señal.'}</p>`
          : falta.length ? `<p class="sub">Falta: ${esc(falta.join(', '))}.</p>` : `<p class="sub">Su reporte va a la cola de evaluación de ${esc(CIUDADES[pr.ciudad].nombre)}, ordenada por riesgo y por las personas del hogar.</p><button class="btn pri bloque" id="enviar">${ICON.enviar} Enviar solicitud</button>`}
      </div>
      <a class="card" href="#/derechos/${pr.id}" style="text-decoration:none;color:inherit"><h3>${ICON.balanza} Sus derechos según su caso</h3><p class="sub">Arriendo, registro de damnificados, ayudas, licencias. Con la norma citada y los plazos calculados.</p></a>
      <a class="btn bloque" href="#/expediente/${pr.id}">${ICON.doc} Ver el expediente completo</a>
    </div></div>`;
    $('#enviar', P)?.addEventListener('click', async () => {
      pr.solicitudEnviada = new Date().toISOString();
      anotar(pr, 'Solicitud de evaluación enviada', 'ciudadano');
      await guardar();
      const n = await enviarPendientes();
      toast(n ? 'Solicitud recibida.' : navigator.onLine ? 'Guardada. Se reintentará el envío.' : 'Sin señal: se enviará sola cuando vuelva.', 3500);
      pintar();
    });
  }

  await pintar();
  return () => { if (mapa) mapa.remove(); };
}
