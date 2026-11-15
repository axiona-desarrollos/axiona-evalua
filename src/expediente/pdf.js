// Expediente PDF del predio: todo lo que se sabe de la vivienda, con método y fuentes.
import { CIUDADES } from '../nucleo/ciudades.js';
import { ESTADOS } from '../nucleo/predio.js';
import { coordTexto } from '../nucleo/geo.js';
import { textoMMI, demandaVsDiseno, nivelFalla } from '../sismo/sitio.js';
import { ELEMENTOS, PATRONES, categoriaBRE } from '../medir/orientacion.js';
import { CARTELES } from '../evaluacion/formulario.js';
import { S, nsrCiudad } from '../nucleo/estado.js';
import { analizar } from '../derechos/motor.js';
import { descargarBlob } from '../ui/base.js';

// jsPDF con letra estándar solo dibuja Latin-1: se reemplazan los símbolos que no caben
const L1 = t => String(t ?? '').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/→/g, '->').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/·/g, '·').replace(/[^\x20-\xFF\n]/g, '');
const n = (v, d = 1) => (v === null || v === undefined || Number.isNaN(+v) ? '-' : (+v).toLocaleString('es-CO', { maximumFractionDigits: d }));

export async function pdfExpediente(pr) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const C = CIUDADES[pr.ciudad], W = 216, M = 16;
  let y = 0;
  const nuevaPag = () => { doc.addPage(); y = 18; pie(); };
  const pie = () => { doc.setFontSize(7.5); doc.setTextColor(120); doc.text(L1(`AXIONA EVALÚA · Expediente ${pr.id} · ${new Date().toLocaleDateString('es-CO')} · Documento de apoyo: no reemplaza el concepto oficial ni el diseño estructural firmado.`), M, 272); doc.setTextColor(0); };
  const espacio = h => { if (y + h > 262) nuevaPag(); };
  const titulo = t => { espacio(14); y += 4; doc.setFillColor(11, 31, 51); doc.rect(M, y - 4.5, W - 2 * M, 7, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text(L1(t), M + 2.5, y); doc.setTextColor(0); doc.setFont('helvetica', 'normal'); y += 7; };
  const texto = (t, tam = 9.5, color = 0) => { doc.setFontSize(tam); doc.setTextColor(color); for (const l of doc.splitTextToSize(L1(t), W - 2 * M)) { espacio(5); doc.text(l, M, y); y += tam * 0.46; } doc.setTextColor(0); y += 1; };
  const fila = (k, v) => { doc.setFontSize(9.2); const ls = doc.splitTextToSize(L1(v), W - 2 * M - 48); espacio(ls.length * 4.4 + 1); doc.setFont('helvetica', 'bold'); doc.text(L1(k), M, y); doc.setFont('helvetica', 'normal'); ls.forEach((l, i) => doc.text(l, M + 48, y + i * 4.4)); y += ls.length * 4.4 + 1.2; };

  // portada
  doc.setFillColor(5, 8, 13); doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(25, 211, 197); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('AXIONA EVALÚA · RECONSTRUCCIÓN POST-SISMO', M, 13);
  doc.setTextColor(255); doc.setFontSize(17); doc.text(L1(`Expediente de la vivienda ${pr.id}`), M, 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(L1(`${pr.ubicacion.direccion || ''} · ${pr.ubicacion.barrio || ''} · ${C.nombre} (${C.departamento})`), M, 31);
  doc.setTextColor(0); y = 48; pie();
  if (pr.demo) texto('DATOS DE DEMOSTRACIÓN: nombres, direcciones y ubicaciones ilustrativos.', 9, 150);

  titulo('1. Identificación');
  fila('Estado', ESTADOS[pr.estado] || pr.estado);
  fila('Ubicación', `${coordTexto(pr.ubicacion)}${pr.ubicacion.precision ? ` (±${pr.ubicacion.precision} m, ${pr.ubicacion.gps ? 'GPS' : 'marcada en mapa'})` : ''}`);
  if (pr.ubicacion.referencia) fila('Referencia', pr.ubicacion.referencia);
  if (pr.ubicacion.numeroPredial) fila('Número predial', pr.ubicacion.numeroPredial);
  fila('Vivienda', `${pr.vivienda.sistema || 'sistema sin definir'} · ${pr.vivienda.pisos} piso(s)${pr.vivienda.ph ? ' · propiedad horizontal' : ''}`);
  fila('Hogar', `${pr.hogar.personas || '-'} personas · menores ${pr.hogar.menores || 0} · mayores ${pr.hogar.mayores || 0} · discapacidad ${pr.hogar.discapacidad || 0} · tenencia ${pr.hogar.tenencia || '-'}`);
  fila('Contacto', `${pr.contacto.nombre || '-'}${pr.contacto.telefono ? ' · ' + pr.contacto.telefono : ''}${pr.contacto.consentimiento ? ' · autorizó tratamiento de datos (Ley 1581)' : ''}`);

  const o = pr.orientacion;
  if (o) { titulo('2. Orientación (escala propia de Axiona, no es el cartel oficial)'); texto(`${o.t}. ${o.d}`); o.razones.forEach(r => texto('- ' + r, 9)); o.acciones.forEach(a => texto('* ' + a, 9)); }

  if (pr.sismo) {
    const m = textoMMI(pr.sismo.mmi);
    titulo('3. El sismo del 10-ago-2026 en el predio (ShakeMap USGS us6000tjl2)');
    fila('Intensidad', `MMI ${n(pr.sismo.mmi)} (${m.romano}, ${m.sacudida}): ${m.dano}`);
    fila('Movimiento', `PGA ${n(pr.sismo.pga)} %g · PGV ${n(pr.sismo.pgv)} cm/s · PSA 0,3 s ${n(pr.sismo.psa?.[0.3])} %g · 1,0 s ${n(pr.sismo.psa?.[1])} %g`);
    fila('Terreno', `Licuación: ${nivelFalla(pr.sismo.licuacion).nivel} (${pr.sismo.licuacion === null ? 'sin dato' : n(pr.sismo.licuacion * 100, 1) + ' %'}) · Deslizamiento: ${nivelFalla(pr.sismo.deslizamiento).nivel} · Vs30 malla ${n(pr.sismo.vs30, 0)} m/s`);
    const st = pr.analisisSismo || {};
    const d = demandaVsDiseno({ ...pr.sismo, psa: { 0.3: pr.sismo.psa?.[0.3], 0.6: pr.sismo.psa?.[0.6], 1: pr.sismo.psa?.[1], 3: pr.sismo.psa?.[3] } }, nsrCiudad(pr.ciudad), { perfil: st.perfil, alturaM: st.alturaM || (pr.vivienda.pisos || 1) * 2.7, sistema: st.sistemaPeriodo || (pr.vivienda.sistema === 'porticos' ? 'porticosConcreto' : 'otros'), T: st.T, I: st.I });
    if (d && !d.requiereEstudio) {
      fila('NSR-10', `Aa ${d.Aa} · Av ${d.Av} · suelo ${d.perfil} (Fa ${d.Fa}, Fv ${d.Fv}) · T ${n(d.T, 3)} s · Sa ${n(d.Sa, 3)} g`);
      fila('Demanda/diseño', `r = PSA(T)/Sa(T) = ${n(d.psa / 100, 3)} / ${n(d.Sa, 3)} = ${n(d.r, 2)}. ${d.lectura}`);
    }
    texto('Estimación regional (malla ~1 km). Fuente oficial en Colombia: Servicio Geológico Colombiano.', 8, 110);
  }

  const sen = Object.keys(pr.senales || {}).filter(k => pr.senales[k]);
  if (sen.length) { titulo('4. Señales reportadas'); texto(sen.join(' · ')); }

  if (pr.grietas.length || pr.inclinaciones.length) {
    titulo('5. Mediciones con el celular');
    pr.grietas.forEach((g, k) => {
      const u = g.ultima; if (!u) return;
      const cat = categoriaBRE(u.anchoMm);
      fila(`Grieta ${k + 1}`, `${ELEMENTOS[g.elemento] || ''} · ${PATRONES[g.patron] || 'otro'} · ancho ${u.automatico?.noResuelta && !u.manual ? '<= ' : ''}${n(u.anchoMm, 2)} mm${u.automatico ? ` (±${n(u.automatico.incertidumbreMm, 2)}, ${n(u.automatico.calidad?.pxmm, 1)} px/mm)` : ''}${u.manual ? ' · corregido a mano' : ''} · BRE ${cat.cat} (${cat.n})${g.previa ? ` · antes ${n(g.previa.anchoMm, 2)} mm` : ''}`);
      if (u.miniatura) { espacio(32); try { doc.addImage(u.miniatura, 'JPEG', M + 48, y, 40, 28); } catch { /* */ } y += 31; }
    });
    pr.inclinaciones.forEach(i => fila(`Desplome · ${i.elemento}`, `${n(i.deriva, 2)} % (±${n(i.incertidumbre, 2)}) · ${n(i.desplomeMm, 0)} mm en ${n(i.alturaM, 1)} m · ${i.lectura?.n || ''}`));
    texto('Método: tarjeta-regla con marcadores (homografía) y ancho por área bajo el perfil; inclinómetro por inversión 180° (cancela el sesgo). Lectura de grietas: BRE Digest 251; deriva residual: FEMA P-58.', 8, 110);
  }

  if (pr.evaluacionResumen?.cartel) {
    const e = pr.evaluacionResumen, c = CARTELES[e.cartel];
    titulo('6. Evaluación profesional · fase 1 (Circular Conjunta 73 de 2026)');
    fila('Cartel', c.nombre); fila('Significado', c.texto);
    if (e.restricciones) fila('Restricciones', e.restricciones);
    fila('Firmada', `${e.evaluador} · ${new Date(e.fecha).toLocaleString('es-CO')}`);
  }
  if (pr.topo) { titulo('7. Levantamiento del lote (Axiona Topo)'); fila('Lote', `${n(pr.topo.area, 1)} m² · perímetro ${n(pr.topo.perimetro, 1)} m · ${pr.topo.puntos} puntos`); }
  if (pr.obra?.resumen) { const r = pr.obra.resumen; titulo('8. Diseño y presupuesto (Axiona Obra)'); fila('Proyecto', r.nombre); fila('Áreas', `Lote ${n(r.loteM2, 1)} m² · construido ${n(r.construidoM2, 1)} m²`); fila('Presupuesto', `${Math.round(r.total).toLocaleString('es-CO')} ${r.moneda || ''} (precios de referencia; ajustar con cotizaciones)`); }

  const sit = pr.derechos?.situacion;
  if (sit) {
    titulo('9. Derechos identificados (información general, no asesoría)');
    for (const d of analizar(sit, { fechas: S.ajustes.fechas }).derechos) { texto(`${d.titulo}${d.plazo ? ` (${d.plazo.texto})` : ''}`, 9.5); texto(d.texto, 8.6, 60); }
  }

  if (pr.fotos.length) {
    titulo('10. Registro fotográfico');
    let x = M;
    for (const f of pr.fotos.slice(0, 8)) {
      if (x + 58 > W - M) { x = M; y += 46; }
      espacio(46);
      try { doc.addImage(f.data, 'JPEG', x, y, 56, 40); } catch { /* */ }
      doc.setFontSize(7.5); doc.text(L1(f.tipo), x, y + 43.5);
      x += 60;
    }
    y += 48;
  }
  titulo('Historial');
  for (const h of pr.historial || []) texto(`${new Date(h.fecha).toLocaleString('es-CO')} · ${h.evento}`, 8.4);
  texto('AXIONA EVALÚA orienta y documenta. El cartel oficial lo asigna un profesional inscrito en el RUPE. Datos tratados conforme a la Ley 1581 de 2012. Axiona Desarrollos Inteligentes S.A.S.', 8, 110);
  descargarBlob(`Expediente_${pr.id}.pdf`, doc.output('blob'));
}
