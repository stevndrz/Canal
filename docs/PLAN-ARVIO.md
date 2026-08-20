# Plan: adoptar el diseño de ARVIO en CanalCasa

## Contexto

CanalCasa (`/home/user/Canal`, rama `claude/arvio-clone-project-cqsoth`) es una app Next.js 16 / React 19 / TypeScript de ~6.550 líneas que ya funciona: reproduce IPTV vía M3U, tiene catálogo TMDB, Chromecast, watch party, navegación D-pad y favoritos. Nada de eso se va a tirar.

ARVIO (`github.com/ProdigyV21/ARVIO`, **Apache 2.0, código público completo**) tiene en `web/` una app browser con **el mismo stack exacto** — Next.js + React 19 + TS + `hls.js` + `mpegts.js` + `lucide-react` — y un lenguaje visual mucho más asentado: shell oscuro a pantalla completa, hero rotativo con logo del título, rieles horizontales y tarjetas con progreso.

> Aclaración importante: ARVIO **no es de pago**. Solo su sincronización en la nube cuesta 2,99 USD/mes. El propio `web/lib/entitlement.ts` dice *"gates the web app only (the APK never checks this)"*: el muro protege su despliegue contra su backend. Ese archivo no se copia y el problema desaparece.

**Objetivo:** traer el diseño de ARVIO al shell de CanalCasa, conservando los sistemas propios que ya funcionan, en fases pequeñas y verificables.

---

## Regla de continuidad (leer primero al retomar)

Este plan se persiste **dentro del repo** como `docs/PLAN-ARVIO.md` (Fase 0). Para retomar en cualquier sesión futura:

1. `git checkout claude/arvio-clone-project-cqsoth && git pull origin claude/arvio-clone-project-cqsoth`
2. Abrir `docs/PLAN-ARVIO.md` y buscar la primera casilla `[ ]` sin marcar.
3. Ejecutar solo esa tarea.
4. Marcar la casilla, `npm run typecheck && npm run lint && npm run build`, commit y push.

**Regla:** una fase = uno o más commits + la casilla marcada en el mismo commit. Nunca dejar una fase a medias sin actualizar el documento. Cada commit termina la frase "Este commit…" en español, como el resto del historial.

Repo de referencia de ARVIO. Es público y va **fijado al mismo commit** que registra `NOTICE.md`, para que cualquier sesión futura lea exactamente el mismo código que se leyó al escribir este plan:

```bash
git clone https://github.com/ProdigyV21/ARVIO.git /tmp/arvio
git -C /tmp/arvio checkout 5bd6a760068ee909692c3df1386af9d6a0d808af
# lo relevante vive todo en /tmp/arvio/web
```

---

## Decisiones ya tomadas

| Decisión | Elección |
|---|---|
| Estrategia CSS | **Importar el CSS de ARVIO tal cual** como hoja aparte; Tailwind sigue disponible |
| Alcance de esta tanda | **Shell + Inicio + tarjetas**. Sin `DetailsDrawer`, sin `PlayerOverlay`, sin `SettingsScreen` |
| Marca | CanalCasa, en español. Cero assets ni nombre de ARVIO (Apache 2.0 §6) |
| Reproductor | Se mantiene `fullscreen-player.tsx` propio, con Cast y watch party |

---

## Licencia y atribución (obligatorio, no opcional)

Apache 2.0 permite copiar, modificar y usar comercialmente. Exige tres cosas:

- [x] `LICENSES/ARVIO-Apache-2.0.txt` — copia literal de `LICENSE` de ARVIO
- [x] `NOTICE.md` en la raíz — qué archivos derivan de ARVIO, de qué commit, y qué se modificó
- [ ] Cabecera de 3 líneas en cada archivo derivado, con ruta de origen y nota de modificación *(se cumple archivo a archivo; la tabla de `NOTICE.md` se actualiza en el mismo commit que añade cada uno)*

**Prohibido:** copiar `arvio-logo.svg`, `arvio-wordmark.svg`, los iconos, el nombre "ARVIO" o su paleta presentada como marca. La cláusula §6 excluye expresamente las marcas registradas. En su lugar se usa `src/lib/logos.ts` y el monograma que ya tienes.

---

## Fase 0 — Dejar el plan marcado en el repo

- [x] Crear `docs/PLAN-ARVIO.md` con el contenido de este plan
- [x] Crear `LICENSES/ARVIO-Apache-2.0.txt` y `NOTICE.md`
- [x] Commit + push a `claude/arvio-clone-project-cqsoth`

Coste: mínimo. **Hacer esto primero, antes que cualquier código**, para que el trabajo quede recuperable aunque la sesión se corte aquí mismo.

---

## Fase 1 — La base de estilo

**Archivos:**
- NUEVO `src/app/arvio-shell.css` ← copia de `/tmp/arvio/web/app/globals.css` (12.680 líneas, 496 selectores, 67 media queries)
- MOD `src/app/globals.css` — añadir `@import "./arvio-shell.css";` **después** de `@import "tailwindcss"`
- MOD `src/app/layout.tsx` — cargar Inter

**Tareas:**
- [x] Copiar el CSS con cabecera de atribución
- [x] Cargar Inter con `next/font/google`. *ARVIO declara `font-family: Inter` pero nunca la carga* (verificado: cero `@import`, `@font-face` o `fonts.googleapis` en su CSS), así que en su web cae al font del sistema. Cargarla de verdad es una mejora gratuita sobre el original.
- [~] Resolver el conflicto de scroll — **movido a la Fase 2** (ver nota abajo)
- [x] Verificar que la app arranca sin cambios visuales todavía: el CSS entra pero ningún componente usa aún sus clases

**Conflicto de scroll — el punto delicado, y por qué se hace en la Fase 2.**

> Corrección de secuencia hecha durante la ejecución. Cambiar el modelo de
> scroll ahora rompería la interfaz *actual* antes de que exista la nueva:
> `html, body { height: 100% }` es lo que hace que los `h-full` de las vistas
> de hoy resuelvan, y al quitar `overflow: hidden` sin el shell de ARVIO
> montado aparecen dos barras de scroll (la de la ventana y la del contenedor
> interno). El cambio va junto al shell que lo necesita, no antes.

Tu `globals.css:38` pone `body { overflow: hidden }` porque el shell nunca scrollea la ventana; el scroll vive en cada contenedor. ARVIO hace lo contrario: la ventana scrollea, `.sidebar` es `position: fixed`, y `TopNav` escucha `window.scrollY > 24` para condensarse. Los dos modelos no conviven.

Resolución: **adoptar el modelo de ARVIO**, pero conservar el bloqueo solo cuando el reproductor está activo.

```css
/* body ya no bloquea el scroll de ventana: el shell de ARVIO lo necesita. */
html[data-player="on"] body { overflow: hidden; }
```

En `dashboard.tsx`, poner/quitar `data-player` en `document.documentElement` según `view === "player"`.

**Verificación:** `npm run build` pasa · la app abre en el reproductor como hoy · al salir al Inicio la ventana scrollea · en el reproductor no scrollea.

---

## Fase 2 — El shell y la navegación

**Origen:** `/tmp/arvio/web/components/shell/AppShell.tsx` (116 líneas) y `TopNav.tsx` (129 líneas).

**Archivos:**
- NUEVO `src/components/shell/top-nav.tsx`
- MOD `src/components/dashboard.tsx` — envolver en `<main className="app-shell">` + `<section className="content">`
- MOD `src/components/app-nav.tsx` — conservar `NAV_ITEMS`, retirar `AppSidebar` y `AppBottomNav`

ARVIO renderiza tres barras del mismo array y las conmuta por CSS: `.sidebar` (escritorio/TV, fija arriba), `.mobile-header` y `.mobile-bottom-nav` (ambas ocultas con `display:none !important` y reactivadas en `@media (max-width: 680px)`).

**Tareas:**
- [ ] Portar `TopNav` a `src/components/shell/top-nav.tsx` con las clases `.sidebar`, `.nav-item`, `.mobile-header`, `.mobile-bottom-nav`, `.settings-gear`
- [ ] Alimentarlo con `NAV_ITEMS` de `app-nav.tsx` — **conservar los 7 destinos actuales**, incluido el `kind: "link"` de `/peliculas`, que ARVIO no tiene. El comentario en `app-nav.tsx:12-19` explica por qué Películas es ruta propia y no una `view`: esa decisión se mantiene.
- [ ] Sustituir el avatar de perfil (ARVIO tiene perfiles, tú no) por el reloj que ya calcula `dashboard.tsx:70-78`, y la marca por el monograma de `src/lib/logos.ts`
- [ ] Añadir `data-nav="button"` a cada botón para que `use-spatial-nav.ts` lo siga viendo
- [ ] **Cambiar el modelo de scroll** (venía de la Fase 1): quitar `overflow: hidden` de `body` en `globals.css`, pasar `html, body` de `height: 100%` a `min-height: 100%`, y añadir `html[data-player="on"] body { overflow: hidden }`. Se hace en el mismo commit que monta el shell nuevo, nunca antes
- [ ] Cablear `data-player` en `<html>` desde `dashboard.tsx` según `view === "player"`

**No portar:** `lib/tvNav.ts` y `lib/gamepadNav.ts` de ARVIO. Tu `src/hooks/use-spatial-nav.ts` (195 líneas) ya cubre navegación D-pad y `useRemoteInput`, y está integrado con `[data-input="dpad"]` en tu CSS. Duplicarlo daría dos motores de foco peleándose.

**Verificación:** las 7 secciones navegan · barra inferior aparece bajo 680px · el mando mueve el foco por la nueva barra · el anillo de foco sigue visible.

---

## Fase 3 — Hero, rieles y tarjetas

Es donde el diseño se nota de verdad.

**Origen:** `HomeScreen.tsx` (196), `MediaRail.tsx` (35), `RailScroller.tsx` (77), `MediaCard.tsx` (268), `LazyRail.tsx` (140).

**Archivos nuevos:** `src/components/media/hero.tsx`, `media-rail.tsx`, `rail-scroller.tsx`, `media-card.tsx`
**Modificados:** `src/components/views/home-view.tsx`, `src/components/channel-rail.tsx`, `src/components/catalog/poster-card.tsx`

**El problema de tipos, y su solución.** ARVIO tiene un `MediaItem` único. Tú tienes dos tipos distintos: `Channel` (`src/lib/types.ts`) y `ResolvedCatalogItem` (`src/lib/catalog/types.ts`). No hay que unificarlos — hay que adaptarlos:

- [ ] NUEVO `src/lib/media-item.ts` con un `CardItem` mínimo (`id`, `title`, `image`, `backdrop`, `subtitle`, `badge`, `progress?`) y dos funciones: `channelToCard()` y `catalogToCard()`. Así una sola `MediaCard` sirve a canales en vivo y a películas.

**Tareas:**
- [ ] `rail-scroller.tsx` y `media-rail.tsx` con `.rail`, `.rail-head`, `.rail-strip`, `.rail-scroll-shell`
- [ ] `media-card.tsx` con `.media-card` (42 bloques CSS), soportando `posterMode` (2:3) y modo backdrop (16:9), barra de progreso y estado "visto"
- [ ] `hero.tsx` con `.hero`, `.hero-copy`, `.hero-meta`, `.hero-actions`, `.hero-logo`. Rotación automática cada 8s que se detiene al primer hover/foco — esa lógica está en `HomeScreen.tsx:62-70`
- [ ] Reescribir `home-view.tsx` con `<div className="screen has-hero">` + hero + rieles

**Recortar al portar** (son dependencias de ARVIO que no tienes): Trakt, `isHomeServer`, `resolveTmdbId`, `getImdbRating`, `openContextMenu`, `serviceLogos`. `MediaCard` baja de 268 a ~120 líneas útiles.

**Reutilizar lo tuyo, no reimplementar:**

| Necesidad | Ya existe en CanalCasa |
|---|---|
| URLs de imagen TMDB | `tmdbImage()`, `POSTER_SIZE`, `BACKDROP_SIZE` en `src/lib/catalog/tmdb.ts` |
| Agrupar canales en rieles | `groupByCategory()`, `channelMark()` en `src/lib/channels.ts` |
| Favoritos y recientes | `usePersistedSet`, `usePersistedRecents` en `src/hooks/use-persisted-set.ts` |
| Logo con respaldo | `src/lib/logos.ts` + `src/lib/logo-index.json` |

**Nota sobre imágenes:** ARVIO usa `<img>` plano y `background-image` en CSS, nunca `next/image`. Al portar, mantener eso — evita tocar `remotePatterns`. **Verificar de paso** si `poster-card.tsx` funciona hoy: usa `next/image` contra `image.tmdb.org` y `next.config.ts` no declara `images.remotePatterns`, lo que normalmente lanza *"hostname not configured"*. Si está roto, se arregla aquí.

**Verificación:** Inicio muestra hero rotativo + rieles · los rieles scrollean con rueda, arrastre y D-pad · las tarjetas de canal muestran logo y respaldo de monograma · `/peliculas` sigue funcionando.

---

## Fase 4 — Cierre y limpieza

- [ ] Retirar código muerto de `app-nav.tsx`, `channel-rail.tsx`, `channel-tile.tsx`
- [ ] Actualizar `README.md`: arquitectura nueva, sección de licencias y atribución
- [ ] Revisar `NOTICE.md` contra lo realmente portado
- [ ] Prueba en teléfono y en TV

---

## Verificación de cada fase

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # el que de verdad atrapa los fallos de SSR
npm run dev         # http://localhost:3000
```

`npm run build` es el que importa: el historial (`8c303e7`, `d2542cd`) muestra que este proyecto ya se cayó con un 500 en producción porque `hls.js`/`mpegts.js` llegaron al paquete del servidor. `next.config.ts` los marca como `serverExternalPackages` y `fullscreen-player.tsx` se carga con `next/dynamic({ ssr: false })`. **No romper ninguna de las dos cosas al mover componentes.**

Comprobación manual mínima por fase: abrir, ver que arranca en el reproductor, salir al Inicio, recorrer las 7 secciones, reducir la ventana a <680px.

---

## Fuera de alcance (decidido, no olvidado)

`DetailsDrawer` (1.030 líneas) · `PlayerOverlay` (1.837) · `SettingsScreen` (2.776) · `LiveTvScreen` (699) · auth, cloud sync, entitlement y paywall · proxy CORS, addons Stremio, resolver, Xtream, Jellyfin/Plex.

El **proxy CORS** (`web/app/api/proxy/route.ts`, 271 líneas) sigue siendo la mejora de mayor retorno pendiente: resolvería la limitación que tu propio README documenta como aceptada. Candidato natural para la tanda siguiente, una vez el diseño esté en pie.
