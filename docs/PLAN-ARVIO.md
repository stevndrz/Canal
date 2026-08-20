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
| Estrategia CSS | **Importar el CSS de ARVIO tal cual**, dentro de `@layer arvio` |
| Alcance | **Paridad visual en todas las pantallas.** No solo el shell: la maqueta de ARVIO manda en Inicio, Canales, Buscar, Favoritos, Ajustes, la ficha y el reproductor |
| Marca | CanalCasa, en español. Cero assets ni nombre de ARVIO (Apache 2.0 §6) |
| Reproductor | **Portar su `PlayerOverlay` entero** y volver a cablear encima Chromecast y Watch Party, que son propios |
| Películas y Series | **Absorberla dentro del App Shell** como una vista más, dejando de ser ruta aparte |
| Guía EPG | **Solo la vista de lista** por ahora; la parrilla queda para después |

### El orden de capas de la cascada, que condiciona todo lo demás

Tres capas, declaradas antes de cualquier `@import` porque el orden lo fija la
primera aparición de cada nombre:

```css
@layer theme, base, arvio, components, utilities;
```

En CSS **toda regla sin capa gana a toda regla en capa**, sin importar la
especificidad. De ahí salieron los dos únicos fallos visuales serios que ha
habido hasta ahora, y los dos fueron invisibles al compilar:

1. El CSS de ARVIO importado suelto hacía que su `button { color: inherit }`
   derrotase a `text-accent-on` de Tailwind: el botón "Ver ahora" salía blanco
   sobre blanco. Se arregló metiéndolo en `arvio`.
2. Los restablecimientos propios de CanalCasa sueltos hacían que
   `button { font: inherit }` derrotase a `.nav-item { font-size: … }` de
   ARVIO: **todos** los botones de la app se pintaban a 16px mientras los
   enlaces salían a 28px. Se arregló metiéndolos en `base`.

**Regla para lo que queda:** los restablecimientos de elemento van en
`@layer base`; el CSS copiado, en `@layer arvio`; los ajustes propios de
CanalCasa, sueltos al final de `globals.css`, que es donde deben ganar. Un
estilo nuevo que "no se aplica" o que "se aplica de más" casi siempre es esto.

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
- MOD `src/app/globals.css` — importar la hoja **dentro de una capa**: `@layer theme, base, arvio, components, utilities;` antes de todo, y luego `@import "./arvio-shell.css" layer(arvio);`. Sin capa, el CSS de ARVIO gana a las utilidades de Tailwind (ver Fase 2)
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
- [x] Portar `TopNav` a `src/components/shell/top-nav.tsx` con las clases `.sidebar`, `.nav-item`, `.mobile-header`, `.mobile-bottom-nav`, `.settings-gear`
- [x] Alimentarlo con `NAV_ITEMS` de `app-nav.tsx` — **conservar los 7 destinos actuales**, incluido el `kind: "link"` de `/peliculas`, que ARVIO no tiene. El comentario en `app-nav.tsx:12-19` explica por qué Películas es ruta propia y no una `view`: esa decisión se mantiene.
- [x] Sustituir el avatar de perfil (ARVIO tiene perfiles, tú no) por el reloj que ya calcula `dashboard.tsx:70-78`, y la marca por el monograma de `src/lib/logos.ts`
- [x] Añadir `data-nav="button"` a cada botón para que `use-spatial-nav.ts` lo siga viendo
- [~] **Cambiar el modelo de scroll** — **movido a la Fase 3**: quitar `overflow: hidden` de `body` en `globals.css`, pasar `html, body` de `height: 100%` a `min-height: 100%`, y añadir `html[data-player="on"] body { overflow: hidden }`. Se hace en el mismo commit que monta el shell nuevo, nunca antes
- [~] Cablear `data-player` en `<html>` — va con el cambio de scroll, en la Fase 3

> Segunda corrección de secuencia. El modelo de scroll no puede cambiar hasta
> que `home-view` sea un `.screen`: hoy las vistas scrollean por dentro con
> `flex-1 overflow-y-auto`, y soltar el scroll de la ventana antes de tiempo
> deja dos barras compitiendo. Mientras tanto la barra fija flota por encima y
> el contenido se aparta con `.below-topbar`, así que cada commit de esta fase
> queda desplegable por sí solo.

**Lo que apareció al ejecutar y no estaba previsto:**

- [x] La barra se oculta durante la reproducción. `.sidebar` es `position: fixed`
  con `z-index: 60` y el reproductor va en `z-50`: sin la condición flotaba
  encima del vídeo. ARVIO hace lo mismo con `activeStream` en su `AppShell`.
- [x] El CSS de ARVIO entra en una **capa** `@layer arvio`, no suelto. En CSS
  toda regla sin capa gana a toda regla en capa, sin importar la
  especificidad, y Tailwind v4 emite sus utilidades dentro de
  `@layer utilities`: importarlo suelto hacía que `button { color: inherit }`
  derrotase a `text-accent-on` en toda la app y el botón "Ver ahora" salía
  blanco sobre blanco. El archivo copiado sigue intacto; solo cambia el
  `@import`.
- [x] Recuperado el nombre en la cabecera del teléfono. ARVIO oculta
  `.profile-name-text` bajo 980px porque allí pone su wordmark, que es marca
  suya y no se copia; sin él la cabecera quedaba con un icono anónimo.
- [x] Etiquetas de la barra ocultas bajo 1400px: ARVIO reparte 4 destinos y
  CanalCasa lleva 6, así que dejan de caber antes.

**No portar:** `lib/tvNav.ts` y `lib/gamepadNav.ts` de ARVIO. Tu `src/hooks/use-spatial-nav.ts` (195 líneas) ya cubre navegación D-pad y `useRemoteInput`, y está integrado con `[data-input="dpad"]` en tu CSS. Duplicarlo daría dos motores de foco peleándose.

**Verificación:** las 7 secciones navegan · barra inferior aparece bajo 680px · el mando mueve el foco por la nueva barra · el anillo de foco sigue visible.

---

## Fase 3 — Hero, rieles y tarjetas ✅

Las primitivas visuales del diseño y el cambio de modelo de scroll.

- [x] `src/lib/media-item.ts` — `CardItem` con `channelToCard()` y `catalogToCard()`. Un canal y una ficha de TMDB no se parecen en nada, así que en vez de unificar los dos tipos se traducen los dos a lo que la tarjeta consume
- [x] `src/components/media/rail-scroller.tsx`, `media-rail.tsx`, `media-card.tsx`, `hero.tsx`
- [x] `home-view.tsx` reescrito como `.screen has-hero`
- [x] El catálogo llega a Inicio desde `src/app/page.tsx`, envuelto en `try`: si TMDB falla, Inicio se queda con los canales en lugar de devolver un 500
- [x] **Modelo de scroll cambiado**: fuera `overflow: hidden` de `body`, `min-height` en lugar de `height`, y `html[data-player="on"]` vuelve a bloquearlo durante la reproducción
- [x] Restablecimientos propios movidos a `@layer base` (ver arriba)

**Decisión de diseño que conviene no deshacer:** el hero rota sobre el
**catálogo** y no sobre los canales. Una ficha de TMDB trae un fondo apaisado
pensado para ocupar la pantalla; un canal solo tiene un logo cuadrado que al
estirarse queda borroso. Los canales mandan en los rieles, donde su logo se ve
bien; el catálogo manda arriba, donde hace falta una imagen grande.

Al portar `MediaCard` se quitaron todas sus peticiones a TMDB. El original pide
logo, duración, nota de IMDb y logotipos de plataforma **por cada tarjeta que se
monta**; con más de 500 canales eso es la diferencia entre un carril fluido y
uno a tirones. Aquí el catálogo ya llega resuelto del servidor.

---

## Fase 4 — Canales con la pantalla de Live TV ✅

La pantalla que más se usa en esta app y la mejor resuelta de ARVIO:
`components/livetv/LiveTvScreen.tsx` (699 líneas).

**Origen:** `LiveTvScreen.tsx` y su `ChannelRow` interno.
**Sustituye a:** `views/canales-view.tsx`, `channel-list.tsx`, `channel-tile.tsx`.

- [x] `src/components/livetv/live-tv-view.tsx` con `.livetv-shell`, `.livetv-topbar`, `.livetv-columns`, `.livetv-cats`, `.livetv-list`
- [x] `ChannelRow` → `.livetv-row` con logo, nombre, programa actual y barra de progreso del EPG, que `src/lib/epg.ts` ya calcula
- [x] Panel de detalle `.livetv-detail` a la derecha
- [x] Categorías con recuento, alimentadas por `CATEGORY_ORDER` de `src/lib/channels.ts`
- [x] **Sin** el conmutador Lista/Guía ni la parrilla: decidido dejarlo para después
- [x] **Sin** la gestión de listas M3U de ARVIO: aquí la lista se configura por `M3U_URL`, no desde la interfaz

**Lo que hizo falta y no estaba previsto:**

- [x] `Channel` gana `currentStart`, `currentEnd` y `nextStart`. Con solo el
  título del programa no se puede dibujar cuánto lleva emitido; `epg.ts` ya
  tenía esas marcas de tiempo y se descartaban al construir el canal.
- [x] Render por lotes de 60 filas con un centinela al final. La lista real
  tiene **7.822 canales**: pintarlos de golpe cuesta cientos de milisegundos en
  un televisor.
- [x] Hueco superior propio en `.livetv-shell`. Su cálculo asume la altura de
  la barra de ARVIO; la nuestra mide `--topbar-h` y lleva la marca escrita
  justo encima del título de la pantalla.

---

## Fase 5 — Buscar y Favoritos

- [ ] `buscar-view.tsx` → `.search-hero` + `.grid-results` (`SearchScreen.tsx`, 28 líneas)
- [ ] `favoritos-view.tsx` → `.library-grid` + `.library-toolbar` (`WatchlistScreen.tsx`)
- [ ] `categorias-view.tsx` → rejilla con el mismo lenguaje

---

## Fase 6 — Absorber Películas y Series en el shell

Decidido: deja de ser ruta aparte y pasa a ser una vista más, como en ARVIO.

- [ ] `peliculas-view.tsx` dentro del shell, con hero + rieles ya construidos en la Fase 3
- [ ] Ficha de título con el diseño de `DetailsDrawer.tsx` (1.030 líneas): temporadas, episodios, reparto y selector de fuentes
- [ ] `NAV_ITEMS` pasa su entrada de `kind: "link"` a `kind: "view"`
- [ ] `/peliculas` y `/peliculas/[mediaType]/[id]` se conservan como redirecciones para no romper enlaces guardados

**Lo que hay que aceptar al hacerlo:** se pierden las URLs propias de cada
título. El comentario de `app-nav.tsx` ya había descartado esto una vez; la
decisión se revierte a conciencia, a cambio de que la navegación y las
transiciones sean las mismas en toda la app.

---

## Fase 7 — Ajustes

- [ ] `ajustes-view.tsx` → `.settings-shell`, `.settings-panel-card`, `.settings-list-row`, `.set-control`
- [ ] Se porta **la maqueta**, no las 2.776 líneas: la mayor parte de ese archivo son opciones de ARVIO que aquí no existen (cuentas, addons, servidores domésticos, Trakt, Telegram)

---

## Fase 8 — El reproductor

La parte más delicada. Se hace al final a propósito: es lo único que hoy
funciona y que ARVIO no puede reemplazar tal cual.

**Origen:** `components/player/PlayerOverlay.tsx` (1.837 líneas).

- [ ] Portar la maqueta y los controles: `.player-overlay`, `.player-top`, `.player-controls`, `.player-panel-row`
- [ ] **Volver a cablear `use-cast.ts` y `use-watch-party.ts`**, que ARVIO no tiene y son la razón por la que este paso va el último
- [ ] Conservar la carga con `next/dynamic({ ssr: false })` y `serverExternalPackages`
- [ ] Añadir salida con Atrás y Escape: hoy solo se sale con el botón, porque `useSpatialNav` va desactivado en el reproductor

---

## Fase 9 — Cierre

- [ ] Retirar el código muerto que vayan dejando las fases anteriores
- [ ] `README.md`: arquitectura nueva, licencias y atribución
- [ ] `NOTICE.md` repasado contra lo realmente portado
- [ ] Prueba en teléfono y en televisor

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

Nada de ARVIO que sea **suyo**: auth, sincronización en la nube, entitlement y
paywall. Y nada que dependa de infraestructura que CanalCasa no tiene: addons de
Stremio, resolver, Xtream, Jellyfin/Plex, Trakt, Telegram.

Dos candidatos claros para cuando la paridad visual esté cerrada:

- **Proxy CORS** (`web/app/api/proxy/route.ts`, 271 líneas). Resolvería la
  limitación que el README documenta hoy como aceptada: "si un canal no carga es
  porque esa fuente no tiene CORS". Es la mejora de mayor retorno pendiente.
- **La parrilla de la guía EPG**, aplazada en la Fase 4.
