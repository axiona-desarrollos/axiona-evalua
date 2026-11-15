# AXIONA EVALÚA · Reconstrucción post-sismo (Quibdó y Pereira)

Una sola app, un expediente por vivienda. Desde el reporte de la familia hasta la reparación, para el sismo del 10 de agosto de 2026 (Mw 7,4, San José del Palmar, Chocó).

Tiene dos puertas sobre el mismo expediente:

- **Mi casa (ciudadanos).**
  - Reporte guiado: ubicación, señales de peligro, fotos, vivienda y hogar.
  - Medición del ancho de grietas en mm con la tarjeta-regla.
  - Desplome de muros y columnas con el acelerómetro.
  - Orientación inmediata con escala propia, sin los carteles oficiales.
  - Derechos con la norma citada y derecho de petición redactado.
  - Funciona sin internet.
- **Axiona Pro (profesionales).**
  - Cola priorizada con un puntaje explicable.
  - Evaluación de fase 1 según la Circular 73 de 2026, con el Agente Axiona (Claude).
  - Sismo en el sitio comparado con el espectro de la NSR-10.
  - **Axiona Topo** para medir el lote.
  - **Axiona Obra** para planos, 3D, IFC/DWG y presupuesto.
  - Expediente en PDF, exportaciones EDAN/RUD y GeoJSON.

Topo y Obra se sirven en el mismo sitio (`/topo/` y `/obra/`). Un puente (`public/puente.js`) devuelve al expediente el levantamiento y el diseño, sin volver a digitar nada.

## Ecuaciones (todas con pruebas en `tests/`)

| Módulo | Qué calcula | Archivo |
|---|---|---|
| Grietas | Homografía de la tarjeta (8 vértices, mínimos cuadrados, Hartley). Ancho por área bajo el perfil: w = ∫(b − I)dx / C. Reporta el percentil 95 con su incertidumbre. Categoría según BRE Digest 251. | `src/medir/grieta.js`, `src/medir/tarjeta.js` |
| Inclinómetro | Inversión 180°: sen θ = Δa / (\|a₁\|+\|a₂\|). Deriva = tan θ y desplome = H·tan θ. Lectura FEMA P-58. | `src/medir/inclinometro.js` |
| Sismo en el sitio | Interpolación bilineal en la malla del ShakeMap us6000tjl2 (MMI, PGA, PGV, PSA, Vs30), licuación (Zhu 2017) y deslizamiento (Nowicki Jessee 2018). | `src/sismo/sitio.js` |
| NSR-10 | Fa y Fv (A.2.4-3/4), espectro Sa(T) (A.2.6), Ta = Ct·h^α. Razón r = PSA(T)/Sa(T). | `src/sismo/nsr10.js` |
| Prioridad | P = 100·Σwᵢ·cᵢ con pesos editables; una señal grave da 80 + 0,2·P. | `src/nucleo/prioridad.js` |
| Plazos | Festivos de Colombia (Ley 51/1983, Pascua por Meeus), días hábiles y meses calendario. | `src/nucleo/calendario.js` |
| Derechos | Motor determinista sobre un corpus curado por artículo. Las preguntas abiertas las responde Claude Haiku 5.5 usando solo Citations. | `src/derechos/` |

Todo lo que pide criterio humano se edita en **Pro › Ajustes**, sin tocar el código:
- pesos de la prioridad y fragilidad por sistema estructural;
- umbrales de grietas;
- fechas legales;
- Aa y Av;
- datos del evaluador.

## Desarrollo

```bash
git clone https://github.com/axiona-desarrollos/axiona-obra ../axiona-obra   # Obra, Topo y el motor de marcadores
npm install
npm test                # pruebas de ingeniería
npm run dev             # solo la app
npm run build:todo      # app + /obra/ + /topo/ + funciones de Obra en dist/
python3 scripts/datos_sismo.py   # regenera public/sismo/ desde la USGS
```

El mapa se arma con extractos de Protomaps (OpenStreetMap, ODbL) en `public/mapa/*.pmtiles` (`pmtiles extract`).

## Despliegue (Netlify)

| Variable | Para qué sirve |
|---|---|
| `ACCESO_CODIGO` y `ACCESO_SECRETO` | Candado de todo el sitio durante la revisión (`netlify/edge-functions/candado.js`). Con `CANDADO=off` el sitio se abre al público. |
| `ACCESO_PIN` | Código del equipo profesional (cola, sincronización, Agente Axiona). |
| `BOCETO_CLAVE` | Lectura de bocetos en Obra (exclusiva del equipo). |

La IA va por el AI Gateway de Netlify. El repositorio no guarda claves de API.

## Límites (honestos)

- No asigna carteles oficiales al ciudadano: eso lo hace el profesional del RUPE.
- No ve dentro de los muros.
- No da alerta temprana.
- No reemplaza el estudio de suelos ni el diseño estructural firmado.
- El corpus legal está pendiente de revisión por un consultorio jurídico aliado.
- Los parámetros NSR-10 de Pereira y los contactos de las entidades están por verificar.

Axiona Desarrollos Inteligentes S.A.S. · Licencia MIT.
