/* AXIONA EVALÚA · Puente con Axiona Obra (/obra/) y Axiona Topo (/topo/), servidas en el mismo sitio.
   - Muestra la barra «Volver al expediente» con el predio en curso.
   - Topo abre Obra aquí mismo (no en obra.axionasoft.com).
   - Guarda en el expediente lo que miden y diseñan, sin volver a escribir nada:
     levantamiento de Topo y resumen + proyecto completo de Obra. */
(function () {
  var ctx = null;
  try { ctx = JSON.parse(sessionStorage.getItem('axiona-predio') || 'null'); } catch (e) { ctx = null; }
  window.AXIONA_OBRA_BASE = location.origin + '/obra/';
  var clave = ctx && ctx.id ? 'axiona-puente:' + ctx.id : null;
  function leer() { try { return JSON.parse(localStorage.getItem(clave) || '{}'); } catch (e) { return {}; } }
  function guardar(parte, valor) {
    if (!clave) return;
    var d = leer(); d[parte] = valor; d.actualizado = new Date().toISOString();
    try { localStorage.setItem(clave, JSON.stringify(d)); } catch (e) { /* lleno */ }
    marcar(parte);
  }
  var t = null;
  addEventListener('axiona:levantamiento', function (e) {
    var d = e.detail || {};
    try { d.estadoTopo = JSON.parse(localStorage.getItem('axiona-topo') || 'null'); } catch (x) { d.estadoTopo = null; }
    guardar('topo', d);
  });
  addEventListener('axiona:proyecto', function (e) {
    clearTimeout(t);
    t = setTimeout(function () {
      var proyecto = null;
      try { proyecto = JSON.parse(localStorage.getItem('axiona-obra-v3') || 'null'); } catch (x) { proyecto = null; }
      guardar('obra', { resumen: e.detail, proyecto: proyecto });
    }, 900);
  });
  function marcar(parte) {
    var b = document.getElementById('axPuenteEstado');
    if (b) b.textContent = parte === 'topo' ? 'Levantamiento guardado en el expediente ✓' : 'Diseño guardado en el expediente ✓';
  }
  if (!ctx) return;
  var css = '#axPuente{position:fixed;left:50%;transform:translateX(-50%);bottom:max(12px,env(safe-area-inset-bottom));z-index:2147483000;display:flex;gap:10px;align-items:center;'
    + 'background:rgba(7,12,19,.94);border:1px solid #1f3346;border-radius:999px;padding:6px 6px 6px 14px;box-shadow:0 12px 40px rgba(0,0,0,.45);font:600 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#dfe9f5;max-width:calc(100vw - 24px)}'
    + '#axPuente span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#8fa3ba;font-weight:500}#axPuente b{color:#19d3c5}'
    + '#axPuente a{flex:none;text-decoration:none;background:linear-gradient(135deg,#19d3c5,#2f7bff);color:#041016;border-radius:999px;padding:9px 14px;font-weight:800}';
  function montar() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var d = document.createElement('div'); d.id = 'axPuente';
    d.innerHTML = '<span><b>' + (ctx.id || '') + '</b> · <span id="axPuenteEstado">' + (ctx.direccion || 'Expediente') + '</span></span><a href="/#/expediente/' + encodeURIComponent(ctx.id) + '">← Volver al expediente</a>';
    document.body.appendChild(d);
  }
  if (document.body) montar(); else addEventListener('DOMContentLoaded', montar);
})();
