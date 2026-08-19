# Handoff: CanalCasa — App Shell nativo para Smart TV y móvil

## Overview

Refactor completo de la UI de **canalcasa** (Next.js 16.2 App Router · React 19 ·
Tailwind CSS 4.1 · lucide-react · hls.js 1.7 · mpegts.js 1.8) de página web a
**app nativa lean-back**: sidebar colapsable en TV/escritorio, barra inferior
flotante en móvil, seis vistas, y reproductor a pantalla completa con zapping
por guía translúcida.

La lógica de streaming NO cambia: la selección de motor (\`getStreamKind\`), el
ciclo de vida de \`Hls\` / \`mpegts.createPlayer\`, el manejo de \`autoplay\`
bloqueado y el reintento son los del proyecto original.

## About the Design Files

Los archivos \`.tsx\` / \`.css\` de este paquete **están escritos contra tu
repo real** (\`stevndrz/Canal@main\`): usan tus alias \`@/\`, tu \`Channel\`, tu
\`loadM3uChannels()\` y tus dependencias del \`package.json\`. Se pueden copiar a
\`src/\` — no son pseudocódigo.

El archivo \`CanalCasa App.dc.html\` es la **maqueta interactiva de referencia**
(HTML, con datos ficticios) que define el look y el comportamiento. Si algo
difiere entre maqueta y \`.tsx\`, manda el \`.tsx\`.

\`CanalCasa Actual.dc.html\` es la recreación del diseño **anterior**, sólo como
punto de comparación.

## Fidelity

**Hi-fi.** Colores, tipografía, espaciado, radios, estados de foco y timings
son finales. Recréalos tal cual.

## Instalación

\`\`\`bash
# desde la raíz del repo
cp -r src/ /ruta/a/canalcasa/src/
npm run typecheck && npm run dev
\`\`\`

Archivos que **reemplazan** los actuales:

| Archivo | Qué cambia |
| --- | --- |
| \`src/app/globals.css\` | Tokens dark en \`@theme\` (Tailwind v4), foco D-pad, overscan, utilidades de scroll. Sustituye el tema claro teal. |
| \`src/app/layout.tsx\` | \`lang="es"\`, \`viewport\` sin zoom, \`colorScheme: dark\`. |
| \`src/components/dashboard.tsx\` | Reescrito como App Shell. |
| \`src/components/stream-player.tsx\` | Mismo motor; superficie \`<video>\` pelada + handle imperativo. El chrome se fue a \`fullscreen-player.tsx\`. |

Archivos **nuevos**: \`src/lib/channels.ts\`, \`src/lib/types.ts\` (amplía el tuyo),
\`src/hooks/*\`, \`src/components/app-nav.tsx\`, \`channel-tile.tsx\`,
\`channel-rail.tsx\`, \`channel-list.tsx\`, \`tv-keyboard.tsx\`,
\`fullscreen-player.tsx\`, \`src/components/views/*\`.

**Sin cambios**: \`src/lib/m3u.ts\`, \`src/app/page.tsx\` (idéntico al tuyo; va
incluido sólo para que el paquete compile solo), \`package.json\`.

## Screens / Views

### App Shell (\`dashboard.tsx\`)

- **Propósito**: contenedor único. Nunca hay scroll de ventana
  (\`body { overflow: hidden }\`); cada vista scrollea en su contenedor.
- **Layout**: \`flex h-dvh overflow-hidden\`.
  - Sidebar: \`92px\` (\`md\`, sólo iconos) → \`264px\` (\`xl\`, con etiquetas).
    Oculto bajo \`md\` (768px). Borde derecho \`rgba(255,255,255,.07)\`.
  - Main: \`flex-1 min-w-0 overflow-hidden\`, padding \`tv-safe\`
    (\`max(40px, env(safe-area-inset-*))\`), \`pt-7\` → \`pt-10\` en \`xl\`,
    \`pb-28\` bajo \`md\` para librar la barra inferior.
  - Barra inferior: \`absolute inset-x-4 bottom-[18px] h-[66px]\`,
    \`rounded-[22px]\`, \`bg-surface-2/70 backdrop-blur-xl\`,
    \`border-white/10\`, sombra \`0 18px 40px -16px rgba(0,0,0,.8)\`. Flotante
    sobre el contenido, no un footer.
- **Estado**: \`view\`, \`lastView\`, \`tunedId\`, \`category\`, \`search\`, \`settings\`,
  \`clock\`; favoritos y recientes en \`localStorage\`.
- **Vacío**: si \`channels.length === 0\`, pantalla "No se pudo cargar la lista"
  con \`router.refresh()\`.

### 1. Inicio (\`home-view.tsx\`)

Hero "Continuar viendo" (\`lg:grid-cols-[1.05fr_0.95fr]\`): kicker con punto
rojo \`#ff453a\` latiendo, título \`34px/1.1\` \`tracking-[-0.03em]\`, meta
\`16px\` \`zinc-400\`, botones "Ver ahora" (relleno \`#fafafa\`, texto \`#09090b\`) y
"Añadir a favoritos" (fantasma). A la derecha, marco 16/9
\`rounded-card border-hairline\`.

Debajo, rieles horizontales de 224px: Seguir viendo · Tus favoritos · y las
primeras 6 categorías de la lista (máx. 20 canales cada una).

### 2. Canales (\`canales-view.tsx\`)

\`lg:grid-cols-[minmax(0,1fr)_400px]\`.
Izquierda: panel 16/9 (click → pantalla completa) con degradados
\`from-black/72\` arriba y \`from-black/78\` abajo; tres acciones
(Ver en pantalla completa · Favorito · PIP); descripción \`max-w-[62ch]\`; pie
con los atajos del mando.
Derecha: botón que abre Buscar, chips de categoría (\`rounded-full min-h-[44px]\`,
activo = relleno accent) y la lista con índice A-Z (\`xl\` y arriba).

### 3. Favoritos (\`favoritos-view.tsx\`)

Cuadrícula \`2 / 3 / 4\` columnas. Estado vacío: marco punteado
\`border-white/12\`, icono \`Star\`, y la explicación de dónde se guardan.

### 4. Buscar (\`buscar-view.tsx\`)

\`lg:grid-cols-2\`. Izquierda: \`<input type="search">\` real a \`26px\` (teclado
físico y táctil funcionan) + \`TvKeyboard\`. Derecha: resultados en vivo; sin
consulta, 24 sugeridos.

Teclas: \`aspect-square min-h-[48px] min-w-[44px] flex-1\` en filas
\`flex-wrap\` — nunca desbordan. Filas: ABCDEFG / HIJKLMN / OPQRSTU / VWXYZÑ /
01234 / 56789, más Espacio · ⌫ · Borrar todo.

### 5. Categorías (\`categorias-view.tsx\`)

Cuadrícula de tarjetas \`min-h-[104px] rounded-[16px] bg-white/[0.04]\` con
nombre + conteo. Al elegir: fija \`category\` y navega a Canales.

### 6. Ajustes (\`ajustes-view.tsx\`)

Grupos en tarjetas \`rounded-[18px]\`, filas \`min-h-[76px]\` separadas por
\`border-white/[0.06]\`. Interruptores \`58×34\` con perilla \`26px\`.
Controlan de verdad el reproductor: \`engine\` (auto / HLS.js / mpegts.js),
\`lowLatencyMode\`, \`enableWorker\`, \`liveBufferLatencyChasing\`,
\`startUnmuted\`. Más: actualizar lista y borrar favoritos.

### 7. Pantalla completa (\`fullscreen-player.tsx\`)

\`absolute inset-0 z-20 bg-black\` sobre el shell.
Cabecera: EN VIVO + \`número · nombre\` a \`22px\` + categoría + reloj mono.
Controles: cinco botones \`58×58 rounded-2xl\` (play/pausa relleno accent; mute,
favorito, guía y salir en \`bg-white/12 backdrop-blur-md\`).
Ambas capas se ocultan a los **4000 ms** (\`transition-opacity duration-300\`) y
despiertan con \`mousemove\` o cualquier tecla.
Guía: overlay inferior \`from-app/92 via-app/55\` con \`backdrop-blur-xl\`, riel de
tarjetas de 196px, el sintonizado con anillo accent; se cierra a los 5000 ms.

## Interactions & Behavior

**Navegación D-pad** (\`use-spatial-nav.ts\`) — geométrica, no orden del DOM:
marca los elementos con \`data-nav\`, mide \`getBoundingClientRect()\` y elige el
vecino real en la dirección pulsada (\`primary + secondary * 2.2\`, umbral 12px).
Llama \`el.focus()\` nativo, así que sirve con mandos reales y con lectores de
pantalla.

- Atrás: \`Escape\` (27), **10009** (Samsung Tizen), **461** (LG webOS).
- \`0-9\`: salta al primer canal de esa centena.
- \`useRemoteInput()\` pone \`data-input="dpad"|"pointer"\` en \`<html>\`: en mando
  el anillo se ve siempre, con ratón sólo en \`:focus-visible\`.
- Sin \`scrollIntoView\` (arrastra la ventana en Tizen). \`scrollNearest()\` ajusta
  \`scrollTop/scrollLeft\` del ancestro scrollable con 28px de holgura.

**En el reproductor** el mando se reinterpreta: \`↑↓←→\` zapea (wrap) y abre la
guía, \`Enter\` alterna la guía, \`Espacio\`/\`k\` play-pausa, \`m\` mute, Atrás sale
a la vista anterior.

**Foco**: anillo \`3px #fafafa\` con \`outline-offset: 4px\`; los tiles además
\`scale(1.045)\`. Todo con \`0.2s cubic-bezier(.22,.61,.36,1)\`.
\`prefers-reduced-motion\` desactiva transiciones y el latido.

**Áreas táctiles**: ningún objetivo bajo 44×44 (chips \`min-h-[44px]\`, filas
\`min-h-[68px]\`, estrellas \`44×44\`, nav inferior \`min-h-[50px] min-w-[48px]\`).

**Responsive**: sidebar completo ≥1200px → iconos 768–1199px → barra inferior
<768px; \`canales\` pasa a una columna, rejillas 4→3→2.

## State Management

| Estado | Dónde | Notas |
| --- | --- | --- |
| \`view\` / \`lastView\` | \`dashboard.tsx\` | \`player\` es overlay, no ítem de nav; \`lastView\` es a dónde vuelve Atrás |
| \`tunedId\` | \`dashboard.tsx\` | Fuente única; el panel y el fullscreen leen lo mismo |
| \`visible\` | \`useMemo\` | \`filterChannels(search, category)\`; define también qué zapea |
| \`favorites\` | \`localStorage\` \`canalcasa:favorites\` | \`Set<number>\` |
| \`recents\` | \`localStorage\` \`canalcasa:recents\` | Máx. 12, MRU primero |
| \`settings\` | \`dashboard.tsx\` | Pasa a \`StreamPlayer\`; cambiarlo remonta el motor |
| play/mute/error | \`stream-player.tsx\` | Sube por \`onStateChange\`; se opera por \`ref\` |

Datos: \`page.tsx\` es un Server Component que llama \`loadM3uChannels()\`
(\`force-dynamic\`, caché de 30 s en \`m3u.ts\`). \`withChannelNumbers()\` renumera
en cliente a 101+/201+ por categoría.

## Design Tokens

Todos en \`@theme\` de \`globals.css\`:

| Token | Valor |
| --- | --- |
| \`--color-app\` | \`#09090b\` |
| \`--color-surface\` | \`#111113\` |
| \`--color-surface-2\` | \`#18181b\` |
| \`--color-mark\` | \`#1c1c1f\` |
| \`--color-hairline\` | \`rgba(255,255,255,.08)\` |
| \`--color-accent\` | \`#fafafa\` |
| \`--color-accent-on\` | \`#09090b\` |
| \`--color-live\` | \`#ff453a\` |
| \`--radius-tile\` / \`--radius-card\` | \`15px\` / \`20px\` |
| \`--ease-native\` | \`cubic-bezier(.22,.61,.36,1)\` |

Texto secundario: \`zinc-400\` (#a1a1aa) · terciario \`zinc-500\` (#71717a) ·
apagado \`zinc-600\` (#52525b).

Tipografía — stack del sistema (\`-apple-system, BlinkMacSystemFont, "Segoe UI",
system-ui\`), no Inter: en Tizen/webOS una webfont es un salto de layout y un
riesgo de red. Escala: \`34\` (h1, \`-0.03em\`) · \`26\` · \`22\` · \`19\` · \`16\` (base
lista) · \`15\` · \`13\` · \`12\` (kickers \`0.16em\` mayúsculas). Nada por debajo de
13px en pantallas de TV.

Espaciado: la escala de Tailwind; padding de vista \`28px\` (\`40px\` en \`xl\`, vía
\`tv-safe\`), gap de rieles \`16px\`, de rejillas \`18px\`, de filas \`6px\`.

## Assets

Ninguno binario. Iconos: **lucide-react** a \`strokeWidth={1.5}\` — House, Tv,
Heart, Search, LayoutGrid, Settings, Play, Pause, Star, Volume2, VolumeX,
Volume1, Maximize, Minimize, List, PictureInPicture2, Delete, RefreshCw, Radio.
Los logos de canal salen de \`channel.logoUrl\` del M3U vía \`next/image\`
\`unoptimized\` (dominios arbitrarios); si falta, marcador de 2 letras.

## Files

| Archivo | Rol |
| --- | --- |
| \`src/components/dashboard.tsx\` | App Shell: rutas de vista, canal sintonizado, mando |
| \`src/components/app-nav.tsx\` | \`AppSidebar\` + \`AppBottomNav\` |
| \`src/components/fullscreen-player.tsx\` | Chrome de TV + guía de zapping |
| \`src/components/stream-player.tsx\` | Motor hls.js / mpegts.js (lógica original) |
| \`src/components/channel-{tile,rail,list}.tsx\` | Tarjeta, riel, lista + índice A-Z |
| \`src/components/tv-keyboard.tsx\` | Teclado en pantalla |
| \`src/components/views/*.tsx\` | Las seis vistas |
| \`src/hooks/use-spatial-nav.ts\` | Navegación D-pad, \`scrollNearest\`, \`useRemoteInput\` |
| \`src/hooks/use-persisted-set.ts\` | Favoritos y recientes |
| \`src/lib/channels.ts\` | Numeración, filtros, agrupado, zapping |
| \`src/lib/types.ts\` | \`Channel\`, \`ViewId\`, \`PlaybackSettings\` |
| \`CanalCasa App.dc.html\` | Maqueta de referencia (nuevo diseño) |
| \`CanalCasa Actual.dc.html\` | Recreación del diseño anterior |

## Pendientes conscientes

- **PIP** usa \`requestPictureInPicture()\` nativo; Tizen/webOS no lo soportan.
  Si quieres PIP dentro de la app, hay que mover el \`<video>\` a un contenedor
  persistente en el shell en vez de montarlo por vista.
- **EPG**: no hay. La lista M3U no trae \`tvg-url\`, así que "en vivo ahora" es
  presencia, no programación.
- **Vista \`canales\` en móvil**: hoy apila panel sobre lista. Si el zapping en
  teléfono importa, conviene volverla lista pura y dejar el vídeo al fullscreen.
- **Virtualización**: \`content-visibility: auto\` aguanta 500–1000 filas. Más
  arriba, mete \`react-window\` en \`channel-list.tsx\`.
