# Estilo HUD de RUOK — guía para implementar

Guía para aplicar al frontend (`frontend/`) el estilo de las maquetas del canvas «R U OK? – Diseño móvil». Las 20 pantallas están en `docs/design/mockups/*.dc.html`. Son **referencia de marcado y medidas**: no se ejecutan tal cual (dependen del runtime del canvas), pero cada valor de color, tamaño y espaciado sale de ahí.

## 1. Qué es el estilo

Una interfaz tipo HUD de videojuego espacial ("home OS"):

- **Fondo:** casi negro azulado con rejilla fina.
- **Paneles con código:** cada panel lleva un código (`SYS.01`, `ALR.02`) y la esquina superior derecha cortada en diagonal.
- **Chips de estado:** borde de 1 px, un cuadradito del color del estado y texto en mono mayúscula (`■ 1 CRÍT`).
- **Medidores:** barras segmentadas para los niveles; números grandes en mono fina (300).
- **Titulares:** Saira ligera, con la palabra clave en cian ("Buenos días, **Vega.**").
- **Panel principal:** un anillo radial con un arco por cada sistema del cuerpo (7) y líneas guía con etiquetas mono (`ENL / 14 MIN`).
- **Navegación móvil:** 4 pestañas abajo. El SOS está siempre visible arriba a la derecha.

## 2. Restricciones del proyecto que se mantienen

1. **Local-first: sin fuentes externas.** Las fuentes se instalan con npm y Vite las empaqueta. Nada de Google Fonts por URL.
   ```bash
   cd frontend
   npm i @fontsource/ibm-plex-mono @fontsource/saira
   ```
   En `src/main.tsx`:
   ```ts
   import '@fontsource/saira/300.css'
   import '@fontsource/saira/400.css'
   import '@fontsource/saira/500.css'
   import '@fontsource/saira/600.css'
   import '@fontsource/ibm-plex-mono/300.css'
   import '@fontsource/ibm-plex-mono/400.css'
   import '@fontsource/ibm-plex-mono/500.css'
   ```
2. **Temas por entorno (`src/environments/themes/*.ts`).** Se conservan. Los entornos espaciales (ISS, Luna, Marte) pasan a la paleta HUD de abajo. Hospital y geriatría pueden quedarse con su tema actual: el HUD es para el espacio.
3. **Semáforo (FE-04).** Sigue siendo fijo y nunca va solo con color: icono o texto siempre. Hay un cambio respecto a hoy: **nominal pasa de verde a cian `#5FD4E8`**, como en la referencia. **Decisión del equipo:** si preferís mantener el verde, usad `#5FD07A` y el resto del estilo no cambia.
4. **"Sin datos" nunca en verde ni en cian.** Gris `#7C9AA3` y, en la figura o el anillo, segmento apagado `#24434D`.
5. **Accesibilidad.** Objetivos táctiles ≥ 44 px; `<button>`, `<a>` y `<label>` reales; contraste ≥ 4.5:1. Todos los grises de abajo lo cumplen sobre el fondo. Las animaciones se paran con `prefers-reduced-motion`.

## 3. Tokens

Añadir a `src/environments/themes/` un tema `hud` y usarlo en `iss`, `moon` y `mars`. Cumple la interfaz `Theme`:

```ts
export const hud: Theme = {
  scheme: 'dark',
  bg: '#091317',
  surface: '#09151A',      // paneles (en CSS con opacidad .92 sobre la rejilla)
  border: '#1C3540',
  text: '#E6F1F3',
  muted: '#7C9AA3',
  primary: '#5FD4E8',      // cian: botón principal, pestaña activa, foco
  primaryText: '#04161B',
}
```

Tokens extra, fijos en todos los entornos HUD (añadir en `styles/index.css`, dentro de `@theme`):

| Token | Valor | Uso |
|---|---|---|
| `--color-hud-line` | `#15303A` | Separadores de cabecera y de panel |
| `--color-hud-row` | `#12272E` | Separador entre filas |
| `--color-hud-off` | `#163039` | Segmento apagado de las barras |
| `--color-hud-dim` | `#24434D` | Ticks del anillo, segmento "sin datos" |
| `--color-hud-body` | `#C9D8DC` | Texto de cuerpo |
| `--color-hud-soft` | `#A9BCC1` | Subtítulos |
| `--color-st-ok` | `#5FD4E8` | Nominal |
| `--color-st-warn` | `#F5A623` | Atención |
| `--color-st-crit` | `#FF6B6B` | Crítico |
| `--color-st-none` | `#7C9AA3` | Sin datos / desconocido |
| `--font-mono` | `'IBM Plex Mono', ui-monospace, monospace` | Etiquetas, códigos, números |
| `--font-sans` | `Saira, system-ui, sans-serif` | Texto y titulares |

Actualizar `src/components/ui/status.ts` para que los colores del semáforo salgan de estos `--color-st-*`.

## 4. Clases de componente (pegar en `styles/index.css`)

Son las mismas clases de las maquetas, con prefijo `hud-`. Se usan junto a Tailwind.

```css
@layer components {
  .hud-screen {
    background-color: var(--env-bg);
    background-image:
      linear-gradient(rgba(95, 212, 232, 0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(95, 212, 232, 0.045) 1px, transparent 1px);
    background-size: 39px 39px;
  }

  /* Panel con esquina superior derecha cortada */
  .hud-panel {
    position: relative;
    background: rgba(9, 21, 26, 0.92);
    border: 1px solid var(--env-border);
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
  }
  .hud-panel::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 12px;
    height: 12px;
    background: linear-gradient(45deg, transparent calc(50% - 0.7px), var(--env-border) calc(50% - 0.7px),
      var(--env-border) calc(50% + 0.7px), transparent calc(50% + 0.7px));
  }

  /* Cabecera de panel: <div class="hud-panel-head"><b>SYS.01</b>Sistemas<span class="hud-chip">…</span></div> */
  .hud-panel-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 14px 10px;
    border-bottom: 1px solid var(--color-hud-line);
    font: 400 11px var(--font-mono);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--env-text);
  }
  .hud-panel-head b { font-weight: 400; color: var(--env-primary); }

  /* Chip de estado: color con text-st-ok / text-st-warn / text-st-crit / text-st-none */
  .hud-chip {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 7px;
    border: 1px solid currentColor;
    font: 400 10px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .hud-chip::before { content: ''; width: 5px; height: 5px; background: currentColor; }

  .hud-label {
    font: 400 10px var(--font-mono);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--env-muted);
  }

  /* Barra segmentada: <span class="hud-bar text-st-warn"><i style="width:60%"></i></span> */
  .hud-bar {
    display: block;
    height: 7px;
    background: repeating-linear-gradient(90deg, var(--color-hud-off) 0 8px, transparent 8px 10px);
  }
  .hud-bar > i {
    display: block;
    height: 100%;
    background: repeating-linear-gradient(90deg, currentColor 0 8px, transparent 8px 10px);
  }

  /* Fila de lista; la seleccionada lleva una línea cian a la izquierda */
  .hud-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 0 14px;
    border-bottom: 1px solid var(--color-hud-row);
    font: 400 15px var(--font-sans);
    color: var(--color-hud-body);
  }
  .hud-row[aria-current], .hud-row.is-active {
    background: rgba(95, 212, 232, 0.07);
    box-shadow: inset 2px 0 0 var(--env-primary);
    color: #fff;
  }

  /* Botones con la esquina cortada */
  .hud-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 52px;
    border: 1px solid var(--env-primary);
    background: rgba(95, 212, 232, 0.07);
    color: var(--env-text);
    font: 500 12px var(--font-mono);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
  }
  .hud-btn-primary { background: var(--env-primary); color: var(--env-primary-text); }
  .hud-btn-danger { border-color: var(--color-st-crit); color: #FF8F8F; background: rgba(255, 107, 107, 0.08); }
  .hud-btn-danger-solid { border-color: var(--color-st-crit); background: var(--color-st-crit); color: #1A0606; }

  /* Barra de pestañas inferior (móvil) */
  .hud-tabs {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    border-top: 1px solid var(--color-hud-line);
    padding: 0 6px calc(18px + env(safe-area-inset-bottom));
    background: rgba(9, 19, 23, 0.96);
  }
  .hud-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 11px 0 8px;
    font: 400 10px var(--font-mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--env-muted);
    border-top: 2px solid transparent;
  }
  .hud-tab[aria-current='page'] {
    color: var(--env-text);
    border-top-color: var(--env-primary);
    background: linear-gradient(rgba(95, 212, 232, 0.1), transparent);
  }

  @keyframes hud-spin { to { transform: rotate(360deg); } }
  .hud-spin { transform-box: fill-box; transform-origin: center; animation: hud-spin 24s linear infinite; }
  .hud-spin-slow { animation-direction: reverse; animation-duration: 60s; }
  @media (prefers-reduced-motion: reduce) { .hud-spin { animation: none; } }
}
```

Tipografía de referencia:
- **Titular de pantalla:** Saira 300, 28–30 px; la palabra clave en `text-env-primary`.
- **Título de subpantalla:** Saira 400, 18 px, con la etiqueta `hud-label` encima (`SYS.01 / SISTEMA`).
- **Lecturas grandes:** mono 300, 36–56 px; la unidad en 14–18 px `text-env-muted`.
- **Cuerpo:** Saira 400, 14–15 px, color `hud-body`.

## 5. Regla de móvil: sin scroll

**Cada pantalla tiene que caber en 390×844 sin scroll vertical.** Hoy el `<aside>` del `Layout` es un cajón y el contenido es una sola columna larga; eso cambia:

| Si hay más contenido… | Se resuelve con |
|---|---|
| Detalle de un sistema | Su propia ruta, no un panel desplegable dentro del dashboard |
| Formularios largos (medir, check-in) | Pasos: una pantalla por paso o por pregunta |
| Listas largas (historial, alertas resueltas) | Paginación (8 filas) o pestañas |
| Opciones secundarias | Pantalla «Más» |

En escritorio (≥ md) se mantiene la barra lateral, con estos estilos, y ahí sí se permite el scroll.

## 6. Cambios por componente y ruta

| Ruta / componente | Maqueta | Qué cambia |
|---|---|---|
| `components/ui/Layout.tsx` | todas | **Móvil:** quitar el cajón y el botón «☰ Menú». Arriba: cabecera con «R U OK» en mono, nodo (`NODO.MARTE / BASE B2`), reloj en mono 300 (`10:42:18` · `SOL 44`) y botón `SOS` (`hud-btn-danger`, 44 px). Abajo: `hud-tabs` con las rutas que permita el rol. **Escritorio:** se mantiene la barra lateral con `hud-panel`. El pie («No es un dispositivo médico») sale del flujo móvil y pasa a Login y Más |
| Pestañas por rol | `Main`, `Members` | `member`: Panel, Medir, Misiones, Más. `medic`/`commander`: Tripulación, Alertas, Medir. Las demás rutas se llegan desde «Más» |
| `components/alerts/SosButton.tsx` | `Main` (cabecera) | Deja de flotar: pasa a la cabecera. Abre la ruta o diálogo SOS |
| `pages/Login.tsx` | `Login` | Anillo decorativo, titular, panel `AUTH.01` (usuario y contraseña), panel `DEMO.02` con usuarios demo y «Pedir ayuda sin sesión» abajo |
| `pages/Dashboard.tsx` | `Main` | Saludo + anillo de 7 arcos (uno por sistema y color por estado; «sin datos» = `hud-dim`) + panel `SYS.01` con 7 `hud-row` (código, nombre, barra, estado). **Los IndicatorCard salen del dashboard** y van a la pantalla de sistema |
| `components/body/BodyFigure.tsx` | `Main` | En móvil la sustituye el anillo. Se puede conservar en escritorio o en `/control` |
| `components/dashboard/SystemPanel.tsx` | `System` | Pasa a ser una ruta (`/system/:id`): anillo pequeño con el estado, panel `INF.01` (función, en el espacio, peligro), `IND.02` con los indicadores enlazados y `REC.03`. Botones: Check-in / Medir ahora |
| `TrendChart.tsx` + `IndicatorCard.tsx` | `Detail` | Lectura grande, chip de estado, selector 7/30 soles, gráfica con banda normal cian y crítica roja, umbrales discontinuos, y fila de 3 datos (media, tu base, umbral) |
| `pages/Measure.tsx` | `MeasurePick`, `Measure`, `Result` | 3 pantallas: rejilla 3×3 de indicadores (+ check-in y PVT) → valor con escala de umbrales del entorno → resultado con «Evaluación actualizada» (antes → después) y recomendaciones |
| `pages/CheckIn.tsx` | `CheckIn` | **Una pregunta por pantalla** (6 pasos), progreso segmentado arriba, escala 1–5 como filas con barra. Las caras emoji se sustituyen por el número + la barra |
| `pages/Pvt.tsx` + `PvtRunner.tsx` | `Pvt`, `PvtResult` | Durante el test: 3 datos arriba y un área grande pulsable con un anillo. El resultado va en otra pantalla |
| `components/alerts/SosDialog.tsx` | `Sos`, `SosSent` | 3 fieldsets en `hud-panel` (qué pasa, cuánto urge, a quién) + `hud-btn-danger-solid`. Confirmación con anillo, cuenta atrás del enlace con la Tierra y «Mientras tanto» |
| `pages/Alerts.tsx` + `AlertDetail.tsx` | `Alerts`, `Alert` | Pestañas Abiertas/Resueltas, filas con hora mono y chip. Detalle: `T−08:42` grande, escalera de entrega (✓ tú, ✓ tripulación, ◷ tierra con barra), protocolo autónomo |
| `components/liveness/RuokModal.tsx` | `Ruok` | Pantalla completa con anillo ámbar, «R U OK?» en mono, cuenta atrás y dos botones grandes (60 px) |
| `pages/Missions.tsx` | `Missions` | Puntos y racha en mono grande, `TSK.01` con 3 tareas, meta cooperativa con barra y 4 insignias hexagonales |
| `pages/History.tsx` | `History` | Selector + 7/30 soles + tabla de 8 filas paginada |
| `pages/Earth.tsx` | `Earth` | Foto en `hud-panel` con pie, distancia y retardo, y Anterior/Siguiente |
| Nueva ruta `/more` | `More` | Accesos (Alertas, Check-in, PVT, Historial, Tierra), `ActivitySelector` (Normal/EVA/Sueño), estado de conexión (`LinkStatusChip`, `PendingSyncChip`, `ServerStatus`) y privacidad |
| `pages/Members.tsx` | `Members` | Saludo, resumen de 4 cifras por estado, lista de la tripulación y alertas por reconocer |
| `StatusBadge.tsx` | todas | Pasa a la forma `hud-chip` (sin `rounded-full`). Mantiene el icono o el texto y el rayado para `unknown`/`stale`/`lost` |

Los textos de las maquetas son los del repo. **Okafor, Lindqvist y Tanaka son nombres de ejemplo:** se usan los del seed.

## 7. Orden de trabajo recomendado

1. Fuentes (`@fontsource`), tokens, tema `hud` y clases `hud-*` en `index.css`.
2. `Layout.tsx`: cabecera y pestañas en móvil, SOS en la cabecera.
3. `StatusBadge` y `status.ts` con los nuevos colores.
4. Dashboard (anillo + lista) y la nueva ruta de sistema.
5. Medir (3 pasos), check-in (1 pregunta por pantalla), SOS.
6. El resto de páginas.
7. Hacer una PR por bloque; no todo en una.

## 8. Cómo comprobarlo

- `npm run lint && npm run build && npm test` en verde, igual que la CI.
- Con `?mocks=1` y el viewport en 390×844 (DevTools), cada ruta del rol `member` sin scroll vertical: `document.documentElement.scrollHeight <= innerHeight`.
- Probar con `prefers-reduced-motion` activo: no gira nada.
- El SOS funciona sin sesión, igual que ahora.
