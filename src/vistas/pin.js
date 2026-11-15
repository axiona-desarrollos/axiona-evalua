// Ingreso al modo profesional con el código del equipo (variable ACCESO_PIN del sitio).
import { modal, esc, ICON } from '../ui/base.js';
import { S } from '../nucleo/estado.js';
import { verificarPin, ponerPin } from '../nucleo/red.js';

export async function pedirPin() {
  const m = modal(`<h3>${ICON.candado} Axiona Pro</h3><p class="sub">Para evaluadores, coordinación y equipos técnicos. Escriba el código del equipo.</p>
    <label class="campo"><span>Código del equipo</span><input id="pinPro" type="password" autocomplete="off" inputmode="text"></label>
    <p class="tenue" id="pinMsg" style="min-height:18px;margin-top:6px"></p>
    <div class="fila fin"><button class="btn" data-r="0">Cancelar</button><button class="btn pri" data-r="1">Entrar</button></div>`, { ancho: 420 });
  const inp = m.el.querySelector('#pinPro');
  setTimeout(() => inp.focus(), 50);
  const intentar = async () => {
    const p = inp.value.trim();
    if (!p) return;
    m.el.querySelector('#pinMsg').textContent = 'Verificando…';
    if (await verificarPin(p)) {
      ponerPin(p); S.pin = p;
      try { sessionStorage.setItem('axiona-pin', p); } catch { /* */ }
      m.cerrar(true);
    } else m.el.querySelector('#pinMsg').innerHTML = `<span style="color:var(--rojo)">${esc('Código incorrecto.')}</span>`;
  };
  m.el.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; if (b.dataset.r === '0') m.cerrar(false); else intentar(); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') intentar(); });
  return !!(await m.promesa);
}
