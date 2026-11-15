// Cómo funciona: fuentes, ecuaciones, límites honestos y licencias.
import { ICON } from '../ui/base.js';
import { CORPUS } from '../derechos/corpus.js';

export async function render(main) {
  main.innerHTML = `<h1>Cómo funciona AXIONA EVALÚA</h1><p class="sub">Una sola app, un expediente por vivienda: del reporte de la familia a la evaluación, el levantamiento, el diseño, el presupuesto y los trámites.</p>
  <div class="rejilla dos" style="margin-top:14px">
    <div class="card"><h3>${ICON.casa} El flujo</h3><ol class="sub" style="padding-left:18px"><li>La familia reporta con fotos, ubicación y señales (sin señal también).</li><li>La app calcula el sismo en el predio y ordena la cola por riesgo y vulnerabilidad.</li><li>El evaluador del RUPE hace la fase 1 con el Agente Axiona y firma.</li><li>Axiona Topo mide el lote; Axiona Obra diseña el reforzamiento o la reconstrucción con planos y presupuesto.</li><li>El expediente PDF y el derecho de petición salen hacia la alcaldía, la curaduría o el operador.</li></ol></div>
    <div class="card"><h3>${ICON.ondas} Datos del sismo</h3><p class="sub">ShakeMap, «¿Lo sintió?», licuación (Zhu 2017) y deslizamientos (Nowicki Jessee 2018) del evento us6000tjl2 de la USGS, recortados a cada ciudad y guardados en la app. Sismos recientes: SGC (oficial) con respaldo USGS. Mapa: OpenStreetMap vía Protomaps, alojado aquí (© colaboradores de OpenStreetMap, ODbL).</p></div>
    <div class="card"><h3>${ICON.regla} Mediciones</h3><div class="formula">Grieta: homografía de la tarjeta (8 vértices, Hartley)
ancho = ∫(fondo − gris) dx / profundidad (área, robusto al desenfoque)
reporte = percentil 95 · u = 0,8 px/escala + 3 %
Inclinómetro: inversión 180°  sen θ = Δa / (|a₁|+|a₂|)
deriva = tan θ · desplome = H·tan θ
Sismo: bilineal en la malla del ShakeMap; PSA(T) log-log
NSR-10: Sa(T) = 2,5·Aa·Fa·I | 1,2·Av·Fv·I/T | ·TL/T²
Prioridad: P = 100·Σ wᵢ·cᵢ (pesos editables)
Plazos: días hábiles con festivos de Colombia (Ley 51/1983)</div></div>
    <div class="card"><h3>${ICON.balanza} Derechos</h3><p class="sub">${CORPUS.length} fichas por artículo de las normas del sismo y permanentes, con fuente y estado de revisión. La guía es un motor de reglas (sin IA); las preguntas abiertas las responde Claude Haiku 5.5 solo con citas a esas fichas. Información general, no asesoría.</p></div>
    <div class="card"><h3>${ICON.alerta} Lo que NO hace</h3><ul class="sub" style="padding-left:18px"><li>No asigna carteles oficiales al ciudadano: eso es del evaluador del RUPE.</li><li>No ve dentro de los muros: ningún celular lo hace («rayos X» no existe).</li><li>No alerta sismos antes de que lleguen: active la alerta de su teléfono Android.</li><li>No reemplaza el estudio de suelos ni el diseño estructural firmado.</li></ul></div>
    <div class="card"><h3>${ICON.candado} Datos personales</h3><p class="sub">Todo se guarda primero en el teléfono. Solo se envía con su autorización (Ley 1581). La IA recibe lo mínimo; no se usan servicios gratuitos que entrenen con sus datos.</p></div>
  </div>
  <p class="tenue" style="margin-top:16px">Axiona Desarrollos Inteligentes S.A.S. · Axiona Obra y Axiona Topo integradas (licencia MIT) · Motor de marcadores de Axiona AR.</p>`;
}
