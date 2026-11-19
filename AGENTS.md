# AGENTS.md — Radar de Riesgo

Guía para agentes de IA que trabajen en este repositorio. Todo el contenido está verificado contra el código actual (19-11-2026).

## Visión general

**Radar de Riesgo** (`radar-de-riesgo`) es una PWA en español, 100 % cliente, que calcula apalancamiento, niveles de margen y escenarios de estrés de un portafolio de inversión a partir de un libro Excel cargado por el usuario. No hay backend: el Excel se parsea en el navegador con SheetJS (`xlsx`), los cálculos son funciones puras en TypeScript y los datos se persisten en `localStorage`. La interfaz es un único panel tipo "radar" con tema oscuro.

Flujo principal: el usuario sube un Excel (o usa el ejemplo precargado) → `src/lib/excel.ts` lo convierte en un `RiskInput` → `src/lib/risk.ts` (`analyzePortfolio`) produce un `PortfolioAnalysis` → los paneles en `src/components/` lo renderizan.

## Pila tecnológica

- **Node.js 22** (verificado: v22.18.0, npm 11.16.0; `info.md` del scaffold menciona Node 20, sin campo `engines` en `package.json`).
- **Vite 7.2.4** + `@vitejs/plugin-react`, TypeScript **5.9 estricto**, React **19.2**, react-router **7** (una sola ruta: `/`).
- **Tailwind CSS 3.4** (no v4) con configuración shadcn/ui (`components.json`, estilo "new-york") y paleta personalizada `radar-*` en `tailwind.config.js`.
- **Radix UI** (primitivas) + `lucide-react` (iconos) + `class-variance-authority`/`clsx`/`tailwind-merge` (utilidad `cn()` en `src/lib/utils.ts`).
- **`xlsx` 0.18.5** para leer el Excel. **`vite-plugin-pwa`** (Workbox, `autoUpdate`) para el service worker.
- **`zod`** valida la copia local (`lib/schema.ts`). **`recharts`** dibuja los gráficos (`components/RiskCharts.tsx`). **`vitest`** ejecuta los tests del motor.
- Otras dependencias instaladas desde el scaffold shadcn (react-hook-form, cmdk, date-fns, embla-carousel, vaul, sonner y varias de Radix) siguen sin usarse por el código de la aplicación.
- `vite.config.ts` incluye `kimi-plugin-inspect-react` (`inspectAttr()`), un plugin de inspección del entorno de desarrollo.

## Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto **3000** |
| `npm run build` | `tsc -b && vite build`; genera `dist/` (PWA incluido) |
| `npm run preview` | Sirve la build de producción |
| `npm run lint` | `eslint .` (flat config en `eslint.config.js`) |
| `npm run test` | `vitest run` (tests del motor y del parser en `src/**/*.test.ts`) |

Estado verificado: `tsc -b`, `npm run build` y `npm run test` pasan. **`npm run lint` falla con 11 errores preexistentes** (no introducidos por los cambios recientes): 7 son `react-refresh/only-export-components` en `src/components/ui/*`, 1 es `react-hooks/purity` por `Math.random` en `src/components/ui/sidebar.tsx:611`, y 3 son `react-hooks/set-state-in-effect` en `src/components/UploadPanel.tsx`, `src/components/ui/carousel.tsx` y `src/hooks/use-mobile.ts`.

## Organización del código (`src/`)

- `main.tsx` — entrada: `StrictMode` + `BrowserRouter` + `index.css`.
- `App.tsx` — rutas; única ruta `/` → `Home`.
- `pages/Home.tsx` — página única. Usa `useRiskData` (estado base + persistencia) y añade el estado efímero del escenario what-if. Calcula `effectiveInput = applyScenario(data, scenario)` y `analysis = analyzePortfolio(effectiveInput)`.
- `hooks/useRiskData.ts` — `useReducer(riskDataReducer)` + persistencia en `localStorage` (clave `radar-riesgo-input-v2`, con migración desde `v1`). Carga la copia local validada con Zod; si es inválida, la descarta y avisa.
- `components/` — paneles de la función de negocio: `UploadPanel` (subida de Excel, descarga de plantilla, restaurar ejemplo), `GlobalCommand` (apalancamiento agregado), `KeyAssetPanel` (niveles del activo clave, con pestañas por activo), `StressPanel` (escenarios de estrés), `PlatformTable` (métricas por plataforma), `AddFundsPanel` (fondos a añadir), `ExecutiveSummary` (resumen ejecutivo), `RiskCharts` (gráficos recharts), `DataEditorPanel` (editor de posiciones/plataformas/config), `WhatIfPanel` (simulador con sliders), `ExportPanel` (copiar/CSV/imprimir). `fields.tsx` exporta los campos reutilizables (`NumberInput`, `TextInput`, `ListInput`). `radar.tsx` exporta los presentacionales compartidos: `RadarPanel`, `TonePill`, `StatusDot`, `MetricBlock`, `RadarButton`, `RadarGhostButton`, `SegmentedTabs`.
- `components/ui/` — ~50 componentes shadcn/ui generados. Editarlos solo si se regenera/actualiza shadcn; el código de la app no los usa casi en su totalidad.
- `lib/risk.ts` — motor de cálculo puro (sin React): `analyzePortfolio`, tonos `safe/warn/danger/neutral`, formateadores `formatCurrency/formatCompact/formatX/formatPct` (locale `es-ES`, USD), parsers numéricos tolerantes (coma decimal, listas con `;` o `,`), `exposureByAsset`, `uniqueAssets`, `maintenancePct`.
- `lib/scenario.ts` — capa de escenario what-if (pura): `ScenarioState`, `applyScenario` (mueve precios y ajusta el patrimonio por P&L, coherente con el estrés), `isScenarioActive`, `EMPTY_SCENARIO`.
- `lib/riskStore.ts` — reducer puro del estado base (`RiskDataState`, `riskDataReducer`, `createInitialState`): mutaciones de posiciones/plataformas/config y coherencia de la selección activo/plataforma.
- `lib/summary.ts` — `buildExecutiveSummary` (prioridad, caída hasta liquidación, mayor aportación, concentración).
- `lib/charts.ts` — datos para los gráficos: `leverageCurve`, `marginByPlatform`.
- `lib/report.ts` — exportación pura: `analysisToCsv` (separador `;`, coma decimal, BOM) y `analysisToSummaryText`.
- `lib/excel.ts` — parseo del libro Excel: hojas requeridas **Plataformas**, **Posiciones** y **Config** (búsqueda tolerante de nombre, sin distinción de acentos). Config con valores por defecto (`keyAsset: 'NVDA'`, margen objetivo 200 %, apalancamiento objetivo x2, margen de mantenimiento 50 %, niveles 200/150/100/50, escenarios 0 a −20 %). Los nombres de plataforma deben ser únicos y toda posición debe referenciar una plataforma existente; si no, la carga falla con un error que indica la fila.
- `types/risk.ts` — tipos de dominio (`RiskInput`, `PlatformAnalysis` → `PortfolioAnalysis`, etc.).
- `data/demoData.ts` — portafolio de ejemplo precargado.
- `hooks/use-mobile.ts` — hook shadcn (`useIsMobile`, breakpoint 768 px).
- `App.css` — CSS muerto del scaffold de Vite; **no se importa en ningún lado** (los estilos viven en `index.css`). No añadir nada ahí.

## Datos: formato Excel

La plantilla descargable es `public/plantilla-radar-riesgo.xlsx` (hay dos copias sueltas en la raíz, `Plantilla_Radar_Riesgo.xlsx` y `Plantilla_Radar_Riesgo_VKIMI.xlsx`, que parecen versiones de trabajo). Hojas y columnas esperadas:

- **Plataformas**: `Plataforma`, `Tipo` (`sin_apalancamiento` | `margen` | `cripto`), `Patrimonio actual`, `Margen usado`, `Notas`; opcional `Margen mantenimiento (%)` por cuenta.
- **Posiciones**: `Plataforma`, `Activo`, `Direccion` (`Compra`/`Venta`; también se acepta signo de cantidad), `Cantidad`, `Precio actual`, `Precio entrada`, `Notas`.
- **Config**: pares `Clave`/`Valor` (`Activo clave`, `Nivel margen objetivo (%)`, `Apalancamiento objetivo`, `Margen mantenimiento (%)`, `Niveles margen`, `Escenarios portafolio`).
- **Resumen**: hoja informativa; el panel web recalcula todo y añade niveles y estrés.

El parser busca la fila de encabezados en las primeras 30 filas, normaliza acentos/minúsculas y acepta alias en inglés (`equity`, `qty`, `side`, …). Errores de validación (faltan hojas, columnas o filas) se lanzan como `Error` con mensaje en español y se muestran en `UploadPanel`.

## Convenciones de código

- **Idioma**: UI, mensajes de error, advertencias (`analysis.warnings`) y comentarios de código en **español**. Mantenerlo así.
- Alias de importación `@/` → `src/` (configurado en `tsconfig*.json` y `vite.config.ts`).
- TypeScript estricto: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (usar `import type` para tipos), `erasableSyntaxOnly`.
- Los paneles de `components/` usan **export default**; `radar.tsx`, `lib/*` y `types/*` usan exportaciones nombradas.
- Estilo: código de la app **sin punto y coma** (los archivos `components/ui/` sí llevan, al estilo shadcn). Sin comentarios superfluos.
- Estilos con clases de Tailwind; condicionales con `cn()`. Paleta semántica `radar-safe/warn/danger/cyan` y tipografía mono (JetBrains Mono) para cifras y etiquetas. Los tonos `Tone` (`safe`/`warn`/`danger`/`neutral`) son el sistema de semáforo de riesgo en toda la UI.
- Arquitectura de datos: `Home` compone estado base (`useRiskData`/`riskStore`) + escenario (`lib/scenario`); `analyzePortfolio` es una función pura de `RiskInput` → `PortfolioAnalysis`; los paneles reciben `analysis` (o `input`/`dispatch` en el editor).
- Constante de tolerancia numérica `EPS = 1e-9` en `src/lib/risk.ts` para divisiones y comparaciones.

## PWA y despliegue

- `vite-plugin-pwa` con `registerType: 'autoUpdate'`, `base: './'` (rutas relativas, sirve desde cualquier subruta) y precaché de `js/css/svg/png/woff/woff2/xlsx`. Las navegaciones usan estrategia `NetworkOnly` (`navigateFallback: null`), es decir, **sin página offline**: sin red no carga la app aunque esté instalada.
- Despliegue = hosting estático de `dist/`. No hay CI, Dockerfile ni configuración de servidor en el repo.

## Seguridad y privacidad

- Sin servidor ni llamadas de red: el Excel nunca sale del navegador y los cálculos son locales. Esto es una propiedad deliberada del producto ("Datos procesados en el navegador"); no añadir telemetría ni envíos de datos sin consenso explícito.
- Persistencia únicamente en `localStorage` del dispositivo (la copia local "solo persiste en este dispositivo").
- `xlsx` se usa solo en el cliente con `file.arrayBuffer()`; no deserializar datos no confiables fuera de ese flujo.

## Estado conocido / deuda

- `npm run lint` tiene 11 errores preexistentes (detallados arriba); conviene no agravarlos y, si se toca `components/ui/` o `UploadPanel.tsx`, valorar corregirlos.
- `src/App.css` es código muerto del scaffold (no importado).
- `recharts` engorda el bundle principal (~1,26 MB, 382 kB gzip); se puede dividir con `import()` dinámico si el primer arranque importa.
- La suite de tests (`vitest`) cubre el parseo numérico, la coherencia exposición/plataformas/estrés, la liquidación, la carga de Excel, el escenario (`scenario.ts`), el reducer (`riskStore.ts`), el resumen, los datos de gráficos y la exportación. Cualquier lógica nueva en `lib/` debería añadir casos ahí además de verificarse con el ejemplo precargado y la plantilla `public/plantilla-radar-riesgo.xlsx`.
- No hay snapshots/histórico: el escenario what-if es efímero y no se persiste (solo se guardan los datos base).
