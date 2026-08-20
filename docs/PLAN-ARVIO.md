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
4. Marcar la casilla, `npm run verify` (tipos + estilo + pruebas + build), commit y push.

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
| Estrategia CSS | ~~Importar el CSS de ARVIO tal cual~~ → **hoja propia** `src/app/shell.css` desde la Fase 6.3: de sus 577 clases se usaban 106 |
| Alcance | **Paridad visual en todas las pantallas.** No solo el shell: la maqueta de ARVIO manda en Inicio, Canales, Buscar, Favoritos, Ajustes, la ficha y el reproductor |
| Marca | CanalCasa, en español. Cero assets ni nombre de ARVIO (Apache 2.0 §6) |
| Reproductor | **Portar su `PlayerOverlay` entero** y volver a cablear encima Chromecast y Watch Party, que son propios |
| Películas y Series | **Absorberla dentro del App Shell** como una vista más, dejando de ser ruta aparte |
| Guía EPG | **Solo la vista de lista** por ahora; la parrilla queda para después |

### El orden de capas de la cascada, que condiciona todo lo demás

> Actualizado en la Fase 6.3. La capa `arvio` ya no existe: el armazón es
> nuestro y vive en `components`.

```css
@layer theme, base, components, utilities;
```

En CSS **toda regla sin capa gana a toda regla en capa**, sin importar la
especificidad. De ahí salieron los dos únicos fallos visuales serios que ha
habido, y los dos fueron invisibles al compilar:

1. Con el armazón importado suelto, su `button { color: inherit }` derrotaba a
   `text-accent-on` de Tailwind: el botón "Ver ahora" salía blanco sobre
   blanco.
2. Con los restablecimientos sueltos, `button { font: inherit }` derrotaba a
   `.nav-item { font-size: … }`: **todos** los botones se pintaban a 16px
   mientras los enlaces salían a 28px.

**Regla:** restablecimientos de elemento en `@layer base`; el armazón
(`shell.css`) en `components`; las pantallas propias, sueltas al final de
`globals.css`, que es donde deben ganar. Un estilo nuevo que "no se aplica" o
que "se aplica de más" casi siempre es esto.

Y la vuelta de tuerca: **con `!important` el orden de las capas se invierte**.
Una `!important` sin capa pierde ante una `!important` con capa.

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
- ~~NUEVO `src/app/arvio-shell.css` ← copia de `/tmp/arvio/web/app/globals.css`~~ *(retirado en la Fase 6.3 y sustituido por `src/app/shell.css`, propio)*
- MOD `src/app/globals.css` — importar la hoja **dentro de una capa**, nunca suelta: sin capa gana a las utilidades de Tailwind (ver Fase 2)
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

## Fase 5 — Buscar y Favoritos ✅

- [x] `buscar-view.tsx` → `.search-hero` + `.grid-results` (`SearchScreen.tsx`, 28 líneas)
- [x] `favoritos-view.tsx` → `.section-heading` + `.grid-results` (`WatchlistScreen.tsx`)
- [x] `categorias-view.tsx` → rejilla propia con el mismo lenguaje

**Dónde nos separamos de ARVIO, y por qué:**

- **Buscar mantiene el teclado en pantalla**, que ARVIO no tiene porque da por
  hecho un teclado físico. En un televisor sin él, un campo de texto es un
  callejón sin salida: el mando solo mueve el foco. Va en columna junto a los
  resultados —apilado encima ocupa más de 500px de alto y empuja los resultados
  fuera de la pantalla, así que se escribiría a ciegas.
- **Favoritos deja fuera todo el selector de origen** de su Watchlist —Trakt,
  Jellyfin, Plex, Emby y sus bibliotecas—. Aquí solo hay un origen: lo marcado
  en este dispositivo.
- **Categorías no existe en ARVIO** (sus categorías viven dentro de Live TV), así
  que no hay nada que portar: se adopta su lenguaje, no su código.

---

## Fase 5.5 — Auditoría funcional y accesibilidad ✅

Insertada por delante del resto del porte. El aspecto ya era el de ARVIO, pero
la app **no se podía usar con un mando** y dos secciones enteras eran
inalcanzables desde un teléfono. Portar más pantallas encima de eso solo
habría multiplicado el problema.

Método: medir en vez de suponer. Un guion recorre las seis vistas a 1920px y a
390px y cuenta elementos interactivos sin nombre accesible, objetivos por
debajo de 44px, secciones inalcanzables y errores de JavaScript. Otro simula un
mando: pulsa Atrás en el reproductor y recorre hero, carriles y barra.

**Lo que encontró, todo real y todo invisible al compilar:**

- [x] **Del reproductor no se salía con el mando.** Ni Escape, ni Atrás, ni las
  teclas de Tizen/webOS. Solo con el botón de la pantalla. En un televisor eso
  es quedarse encerrado. La tecla Atrás se atiende ahora **siempre**, incluso
  con el movimiento del foco desactivado durante la reproducción.
- [x] **Al entrar no había nada enfocado.** Un mando no tiene Tab: sin foco
  inicial, las flechas no tienen desde dónde partir y parece que el mando está
  roto. Ahora cada cambio de pantalla deja el foco en el primer navegable.
- [x] **El foco se quedaba atrapado en la barra superior.** Causa: `data-nav`
  puesto en el contenedor de scroll del carril, que es un `<div>` **no
  enfocable**. `.focus()` sobre un div no hace nada y no avisa, así que el
  motor creía haber movido el foco. Con un mando, la app era solo la barra.
  Arreglado en origen: `collect()` ahora exige que el candidato pueda recibir
  el foco de verdad, así que el fallo no puede repetirse.
- [x] **Pulsar derecha saltaba a la barra de navegación.** Izquierda y derecha
  no deben cambiar de fila: ahora exigen solape vertical con el elemento de
  partida. Arriba y abajo sí cambian de fila y solo penalizan la desviación.
- [x] **Buscar y Categorías no existían en el teléfono.** La barra superior se
  oculta bajo 680px y la inferior solo llevaba cinco de los siete destinos. Los
  siete caben: unos 55px por casilla en una pantalla de 390px.
- [x] **Objetivos táctiles por debajo de 44px**: categorías de Canales (36px),
  interruptores de Ajustes (34px) y flechas de carril. Corregidos.
- [x] **iOS**: sin `viewportFit: "cover"`, `env(safe-area-inset-*)` vale 0 y la
  barra inferior quedaba pegada al indicador de inicio del iPhone. Añadido,
  junto con los metadatos para añadir a la pantalla de inicio.
- [x] **El carrusel no se podía recorrer.** Ahora los tres caminos funcionan:
  con mando, moviendo el foco de tarjeta en tarjeta —el carril sigue al foco—;
  con ratón, las flechas; con el dedo, arrastre con anclaje por tarjeta.
- [x] **El indicador de desarrollo de Next tapaba la pestaña «Inicio»** del
  teléfono. No afecta a producción, pero impedía probar en un móvil real.

**Segunda lección de capas, y va al revés que la primera.** La regla que oculta
las flechas es `display: none !important` dentro de `arvio`. Con declaraciones
`!important` **el orden de las capas se invierte**: una `!important` sin capa
*pierde* ante una `!important` con capa. La anulación tuvo que entrar en la
misma capa y con más especificidad. Para reglas normales, lo de siempre.

**Cómo volver a pasar la auditoría** (los guiones viven en el bloc de notas de
la sesión; si hace falta, se reescriben desde este resumen):

1. Recorrer las seis vistas a 1920 y 390 px contando: interactivos sin nombre
   accesible, objetivos <44px, destinos no visibles, errores de JavaScript.
2. Simular el mando: Atrás en el reproductor; y desde el foco inicial, bajar al
   hero, entrar en un carril y recorrerlo con derecha comprobando que
   `scrollLeft` avanza.
3. Comprobar las flechas del carril con ratón y con dedo por separado
   (`hasTouch`), que dan resultados distintos a propósito.

---

## Fase 5.6 — La televisión primero: reproductor incrustado en Inicio ✅

Cambio de jerarquía pedido tras ver el resultado. La app abría **en pantalla
completa**, que es la puerta de entrada de ARVIO porque su producto va de
películas. CanalCasa va de televisión en vivo, pero abrir en pantalla completa
obligaba a salir antes de poder ver nada más.

- [x] **Arranca en Inicio**, no en el reproductor
- [x] **Tarjeta en directo dentro de Inicio** (`src/components/live-card.tsx`):
  el canal ya suena al entrar, con `EN VIVO`, nombre, número y categoría encima
- [x] **La pantalla completa pasa a ser una decisión**: doble clic en la
  tarjeta, Enter con el mando, o el botón «Pantalla completa»
- [x] **Los canales mandan en Inicio.** Fuera la cabecera de película a toda
  pantalla; el catálogo baja a una sección propia, «Películas y series», detrás
  de los rieles de canales
- [x] **Un solo botón de pantalla completa** en el reproductor grande. Había
  dos —uno pedía la pantalla completa del navegador y otro devolvía a la
  navegación— y se confundían. Ahora «pantalla completa» es un estado y un solo
  botón lo deshace entero
- [x] **Fuera el botón de favoritos del reproductor, entra «Siguiente canal».**
  Cambiar de canal es lo que más se hace viendo la tele; marcar un favorito se
  hace desde la lista, con la parrilla delante y sin tapar el vídeo
- [x] Canal de arranque configurable con `NEXT_PUBLIC_CANAL_INICIAL`
  (por defecto «Canal 7»); si no está en la lista de hoy, cae al primero

**Reglas de interacción que quedan fijadas:**

- Una tarjeta de canal **en Inicio** cambia lo que suena en la tarjeta de
  arriba. No salta a pantalla completa: ya estás viendo, y quitarte la pantalla
  que mirabas sería un castigo por explorar.
- Una fila de canal **en Canales** sí abre a pantalla completa: ahí estás
  eligiendo qué ver, no viendo.

**Lo que volvió a aparecer en la auditoría, y su arreglo:**

- [x] Al pulsar arriba desde un riel, el foco saltaba a la barra de navegación
  en vez de al riel de encima. Las barras son fijas, así que geométricamente
  están siempre pegadas al borde y ganaban cualquier movimiento vertical: no se
  podía volver hacia arriba. Ahora van marcadas con `data-nav-chrome` y salir
  del contenido hacia ellas tiene un coste, de modo que solo ganan cuando no
  hay contenido en esa dirección.

---

## Fase 5.7 — Reproductor propio y chrome parejo en todas las rutas ✅

Tres cosas que se veían usando la app y no compilando.

**Películas llevaba varias fases reventando.** No es que "la barra
desapareciera": la ruta entera se caía. Sus fichas usan `next/image` contra
TMDB y `next.config.ts` no declaraba ese host; `next/image` no degrada a una
imagen rota, **lanza y tumba la ruta completa**. Estaba anotado como "verificar
de paso" desde la Fase 3 y nunca se comprobó. Lección: una nota de "verificar"
sin ejecutar no vale nada.

- [x] `images.remotePatterns` con TMDB, y solo TMDB: los logos de canal salen de
  cientos de dominios de listas IPTV y por eso van con `<img>` normal
- [x] `/peliculas` pinta el mismo chrome que el resto: `.app-shell`, `TopNav`,
  `.screen`
- [x] `TopNav` aprende a vivir fuera del App Shell: la sección activa la decide
  la URL, volver a una vista se pide con `?vista=`, y el reloj pasa a ser suyo
  en vez de un prop

**Pantalla completa en un solo gesto.** El botón solo cambiaba de vista, así que
el navegador seguía enseñando su barra de direcciones y hacía falta un doble
clic más. `requestFullscreen` **solo vale dentro de un gesto de la persona**,
así que se pide en el mismo clic y sobre el documento, porque el contenedor del
reproductor todavía no existe en ese instante.

**Reproductor nuevo** (`src/components/player/player-controls.tsx`), compartido
por el pequeño de Inicio y el de pantalla completa. Antes eran seis círculos
idénticos de 58px, solo icono, translúcidos con desenfoque. Tres problemas
reales, ninguno de gusto:

- [x] **Jerarquía en vez de uniformidad.** Pausar pesaba lo mismo que "ver en
  familia". Ahora hay primario, secundarios y ocasionales, y el tamaño lo dice
- [x] **Fondo sólido en vez de cristal.** El translúcido se veía sobre una
  escena oscura y desaparecía sobre una clara: la legibilidad dependía de lo
  que estuvieran emitiendo
- [x] **Las palabras se ven.** Un icono solo sirve a quien ya lo conoce
- [x] **Ajuste «Controles grandes»** (`bigControls`): sube tamaños y saca todas
  las etiquetas. Una misma app para quien reconoce los iconos y para quien no
- [x] **Ocultar solo en pantalla completa**, a los 5 segundos y no 4. En el
  reproductor de Inicio los controles van debajo del vídeo, donde no tapan
  nada, y no se ocultan nunca
- [x] El botón de pantalla completa **nunca se queda sin texto**: es el único
  que cambia el modo entero de la aplicación

---

## Fase 5.8 — Encaje real en cada pantalla ✅

Todo salió de capturas de un iPhone de verdad, y todo era invisible en pruebas
de escritorio.

**Teléfono en horizontal.** El caso no es de anchura sino de **altura**: girado,
un teléfono tiene unos 874px de ancho —así que ninguna regla de
`max-width: 680px` entra— pero solo 402px de alto. Con los tamaños de
escritorio, la barra de controles se partía en dos filas pegadas a la izquierda
y el hueco superior de `.screen` se llevaba 120px de los 402, empujando los
controles por debajo del pliegue: había que scrollear para pausar.

- [x] La barra va **centrada** (`justify-content: center`); con `space-between`
  los dos grupos se iban a los extremos y al envolverse quedaban desalineados
- [x] Media query por `max-height: 520px` y `orientation: landscape`, no por
  anchura
- [x] Hueco superior y tamaño de la tarjeta recalculados para que vídeo y
  controles quepan a la vez sin scroll

**Pantalla completa en iPhone.** Safari en iPhone **no implementa la Fullscreen
API sobre nada que no sea un `<video>`**: en una pestaña normal
`requestFullscreen` ni existe, y por eso la barra de direcciones seguía encima.

- [x] Cadena de intentos: estándar → WebKit sobre el documento →
  `video.webkitEnterFullscreen()`. El último es el único que un iPhone acepta,
  y entrega el reproductor nativo de Apple —con AirPlay incluido— a cambio de
  no ver nuestros controles
- [x] La otra vía, que conserva el diseño: **añadir la app a la pantalla de
  inicio**. Ahí abre sin nada de Safari alrededor

**Enviar a la TV desde Inicio.** `useCast` ya existía y solo vivía en el
reproductor grande; ahora la tarjeta de Inicio lo lleva también.

**Películas, rediseñada.**

- [x] El buscador deja de ser un botón en `position: absolute` encima del campo
  con 7rem de `padding-right` reservados. En un teléfono eso dejaba sitio para
  cuatro letras antes de que el texto se metiera debajo del botón. Ahora campo
  y botón son hermanos en una fila, centrada y acotada
- [x] **La galería usa `MediaRail` y `MediaCard`**, las mismas de Inicio. Tenía
  su propia rejilla de pósters de ancho fijo (132/180px): en un televisor de
  1920 eso eran dos carátulas diminutas arriba a la izquierda con el resto de
  la pantalla en negro. Reutilizarlas trae gratis tamaños fluidos, flechas de
  carril, navegación con mando y arrastre con anclaje
- [x] Los chips dejan de ser morados —lo único morado de toda la app— y
  scrollean en horizontal en vez de recortarse: los géneros de TMDB son
  veintitantos
- [x] `.screen` pasa a `grid-template-columns: minmax(0, 1fr)`. Sin acotar, la
  columna se ensanchaba hasta el contenido más ancho: la rejilla de pósters
  arrastraba consigo al buscador, que en un teléfono de 390px salía de 626px
- [x] La ficha de un título lleva la barra, y vídeo y servidores van centrados
  y acotados: a 1400px el vídeo se comía la pantalla y los botones de servidor
  colgaban en la esquina izquierda, lejos de la imagen a la que se refieren

**Ajustes en teléfono.** Cada fila era una línea con etiqueta, pista y control;
en 390px no caben. Ahora se apilan por debajo de `sm`, y la pista deja de
truncarse porque ahí sí hay sitio para leerla entera.

---

## Fase 5.9 — El reproductor como reproductor ✅

**La rueda del ratón no movía la página en escritorio.** Causa: ARVIO pone
`overflow-x: hidden` en `body`, y el CSS tiene una regla poco conocida — si
`html` está en `visible`, **el overflow del `body` se propaga al viewport**. El
viewport quedaba en `overflow: hidden auto` y el `body` pasaba a ser el
contenedor de scroll. En Chrome se nota poco; en Safari y Firefox, combinado con
elementos `position: fixed` como la barra, es la causa clásica de que la rueda
deje de responder.

- [x] `overflow-x: clip` sobre `html, body`: recorta igual pero **no crea
  contenedor de scroll ni se propaga**. Declarado después de `hidden` para que
  los navegadores viejos de televisor que no lo conocen se queden con lo de
  antes, que para ellos ya funcionaba

**El cartel de «Activar sonido» ya no existe.** Si el navegador bloqueaba el
autoplay con audio, se tapaba el vídeo con un cartel y no se veía **ni sonaba**
nada hasta pulsarlo: lo contrario de lo que quiere quien abre una app de TV.

- [x] Ante un bloqueo se silencia y se reintenta. Todos los navegadores permiten
  el autoplay en silencio, así que la imagen aparece siempre. El botón de sonido
  vuelve a ser un control y no un peaje

**Los controles viven dentro de la imagen en escritorio.**

- [x] El marco pasa a ser un contenedor posicionado y el vídeo vive dentro con
  su proporción. Esa separación permite las dos disposiciones sin duplicar
  maqueta
- [x] En escritorio, la barra se apoya en el borde inferior del vídeo y aparece
  al acercar el ratón o **al enfocar con el mando** (`:focus-within`, que es lo
  que evita navegar a ciegas por una barra invisible)
- [x] En teléfono se queda debajo, en el flujo: ahí tapar el vídeo cuesta caro, y
  esa disposición —imagen arriba, botones grandes abajo— es la que hace que se
  lea como un mando para pasar el canal a la tele
- [x] `margin-inline: auto` en el marco: **estaba pegado a la izquierda** con
  medio televisor en negro al lado

**La señal sigue a la pestaña.** El reproductor lo montaba Inicio, así que al
pasar a Canales React lo desmontaba y la emisión se cortaba.

- [x] Montado en el shell, ocupa el mismo sitio del árbol en Inicio y en
  Canales: React conserva la instancia, el `<video>` no se recrea y la emisión
  no se interrumpe mientras se busca otro canal. Verificado comparando la
  identidad del elemento `<video>` antes y después de cambiar de pestaña
- [x] En las demás vistas no se monta: nadie va a Ajustes a ver la tele, y así
  no se gasta ancho de banda en segundo plano

---

## Fase 6 — Fuente propia y Watch Party ✅ (primera versión)

La pantalla «Mi enlace» ya funciona: pegar un enlace, guardarlo en el
dispositivo, reproducirlo y abrir una sala sincronizada.
Ver [`docs/FUENTE-PROPIA.md`](FUENTE-PROPIA.md) para el contrato y lo que falta.

Decisión de producto, ya aplicada: el Watch Party **solo** tiene sentido sobre
una fuente propia. En Canales no hace falta —una emisión en vivo ya va igual
para todos y no se puede pausar ni buscar— y en Películas por iframe es
imposible, porque el `<video>` vive en otro dominio. **Retirado del reproductor
de canales**, donde ocupaba un botón sin poder cumplir.

---

## Fase 6.1 — La ficha de un título, y el encaje que faltaba ✅

- [x] **La portada de la ficha ya no se mete debajo de la barra.** Iba en un
  `absolute inset-0` desde y=0, así que el título y el botón de volver se leían
  encima de la navegación. Ahora es una sección con su propio hueco superior
- [x] **`--topbar-h` mentía.** ARVIO declara la altura de `.sidebar` **tres
  veces** y por encima de 680px gana `clamp(96px, 13vh, 154px)`, no la primera:
  la variable decía 93px cuando la barra medía 140, y el reproductor de Inicio
  quedaba 12px *por debajo* del borde de la barra en vez de separado
- [x] **La ficha tiene contenido debajo del vídeo**: sinopsis, dirección o
  creación, reparto con foto en carril, géneros, duración y nota. Todo llega en
  **una sola petición** a TMDB con `append_to_response=credits`
- [x] **Ajustes centrado**, con el mismo `.section-heading` que el resto: su
  `<h1>` suelto era el único encabezado de la app que no reservaba el hueco de
  la barra
- [x] **El reproductor de Inicio se dimensiona por la altura libre**, no por una
  anchura fija: la barra y el vídeo entran juntos y asoma el primer riel

---

## Fase 6.2 — La ficha en columnas, la marca, la calidad y la poda ✅

- [x] **El selector de servidor baja al pie del vídeo.** Antes flotaba suelto
  entre el reproductor y el texto, en una fila de botones idénticos que no
  decían para qué servían. Ahora `.ficha-conjunto` envuelve vídeo y selector en
  una sola pieza redondeada y el selector se presenta con la pregunta que de
  verdad se hace quien lo usa: *¿No se ve o está en otro idioma?*
- [x] **La metadata deja de ser una lista vertical.** `.ficha-columnas` es una
  rejilla de dos columnas por encima de 900px: sinopsis y reparto en la ancha,
  y una `.ficha-tecnica` con `<dl>` de Año, Duración, Dirección, Géneros,
  Valoración, Idioma original y Temporadas al lado. Debajo de 900px se apilan
- [x] **La marca cabe entera.** Se truncaba a "CanalC…" porque el ancho máximo
  lo fija ARVIO pensando en un nombre de perfil. Partida en dos líneas
  (`Canal` / `Casa`) ocupa 49px en lugar de 81 y se lee completa; el monograma
  baja de 58 a 46px, que sigue siendo lo más grande de la barra
- [x] **Elegir un canal en Canales ya no salta a pantalla completa.** Sube al
  principio de la página y lo pone en emisión en el reproductor que ya está
  ahí. Verificado: `scrollY` 1400 → 0, `data-player` sin marcar, la vista sigue
  siendo Canales y hay vídeo
- [x] **Calidad máxima** (`calidadMaxima`): `startLevel: Infinity` y
  `capLevelToPlayerSize: false` en hls.js. Por omisión hls.js arranca en la
  pista baja y sube según mide la conexión, y además limita la pista al tamaño
  en píxeles del reproductor. Con fibra eso se nota como unos segundos borrosos
  en cada cambio de canal, y en un televisor con el vídeo a media pantalla
  impide subir a 1080 aunque la haya. El ajuste rearranca la instancia, porque
  las dos opciones solo se leen al construirla
- [x] **Ajuste de imagen** (`ajusteImagen`): `object-fit` entre *contener* —la
  imagen entera, con bandas si la proporción no encaja— y *llenar* —recortar
  para ocupar toda la pantalla. Un canal 4:3 en un televisor 16:9 se ve
  minúsculo con lo primero y bien con lo segundo
- [x] **Aviso de enlace firmado** en Mi enlace: los enlaces que se sacan de un
  reproductor web llevan `t=`, `e=`, `s=`… y caducan en horas. Se detectan con
  `esEnlaceFirmado()` y se avisa antes de guardarlos, en vez de dejar que el
  usuario descubra días después que su lista está muerta
- [x] **Poda.** Fuera seis componentes sin un solo importador —`app-bar`,
  `site-nav`, `channel-list`, `channel-rail`, `channel-tile`, `media/hero`—,
  cuatro funciones exportadas sin usar —`getCatalog`, `isManual`,
  `findProvider`, `useStoreHydrated`— y tres bloques de CSS huérfanos
  —`.scroll-thin`, `.ficha-autoria`, `.hero-eyebrow`

> **Aviso para la próxima sesión: Turbopack sirvió CSS viejo.** Lanzar
> `npm run build` con `npm run dev` en marcha deja `.next` en un estado en el
> que el servidor de desarrollo sigue sirviendo la hoja anterior. Las medidas
> de esta fase salieron mal la primera vez por eso: `.ficha-columnas` computaba
> `display: block` y la marca salía en una línea, con el CSS correcto en disco.
> Antes de creerse una medición rara, comprobar que la clase existe en la hoja
> servida:
> ```bash
> CSS=$(curl -s localhost:3000 | grep -oP '/_next/static/[^"]+\.css' | head -1)
> curl -s "localhost:3000$CSS" | grep -c ficha-columnas
> ```
> Si da 0, matar el servidor, `rm -rf .next` y volver a arrancar.

---

## Fase 6.3 — Hoja propia, estructura y peso ✅

La tanda que dejó de remendar y reorganizó.

### El armazón visual pasa a ser nuestro

- [x] **Fuera `arvio-shell.css`** (12.704 líneas, 256 KB en producción) y
  dentro `src/app/shell.css`, escrito de cero. De sus 577 clases la app usaba
  106: el 82% era peso muerto. **256 KB → 71 KB** (15 KB comprimidos)
- [x] Con la hoja en nuestras manos, `globals.css` pierde todo el andamiaje
  que existía solo para pelearse con una hoja ajena: el `@layer arvio`, la
  anulación con `!important` invertido, los comentarios sobre qué declaraba
  ARVIO tres veces. **1.801 → 1.610 líneas**
- [x] **Lenguaje visual de televisor**: foco con borde blanco de 4px y
  crecimiento del 6% sobre la carátula; etiqueta siempre debajo de la imagen,
  nunca encima; barra flotante translúcida con desenfoque; píldora blanca para
  el destino activo; un único `--margen` para toda la app
- [x] Tres desajustes que solo aparecen al mirar: la app marca lo activo con
  `is-active` y la hoja nueva decía `.active`; `.top-right` es a la vez el
  grupo derecho de la barra y un modificador de `.cw-badge`, así que se acota
  a `.sidebar >`; el título de la tarjeta es hijo directo de `.media-card` y
  no vive dentro de `.card-meta-row`

### Peso: el documento pesaba más que todo lo demás junto

Medido en producción, la portada mandaba **3,98 MB de HTML** frente a 1,5 MB
de JavaScript. Son los 7.822 canales serializados, y la mitad no servía:

- [x] **Fuera cuatro campos por canal**: `description` (un «Señal en vivo de X»
  generado que no leía nadie), `logoText` (`channelMark()` lo deriva del
  nombre), `isFavorite` (el estado real vive en el store, indexado por
  `streamUrl`) e `isLive` (valía `true` en los 7.822)
- [x] **Los campos de guía se omiten en vez de asignarse.** React codifica una
  propiedad presente con valor `undefined` como el texto literal
  `"$undefined"`: eran 23.488 apariciones, unos 700 KB de decir «aquí no hay
  nada»
- [x] **Resultado: 4,07 MB → 2,14 MB** (–47%). En el cable la mejora es menor
  (474 → 413 KB, porque gzip ya comprimía bien tanta repetición), pero el
  coste de **interpretar** ese JSON se parte por la mitad, y es lo que se nota
  en un televisor barato
- [x] Medido: **FCP 480 → 332 ms · DOMContentLoaded 665 → 351 ms**
- [x] El destello de espera de una tarjeta solo se anima si de verdad hay una
  imagen cargando. Antes bastaba `!loaded`, y `loaded` solo se pone al cargar
  un `<img>`: una tarjeta sin arte se quedaba animando para siempre

### Estructura y estándares

- [x] **`src/lib/config.ts`**: única fuente de configuración. Siete archivos
  leían `process.env` con siete criterios distintos para el valor por defecto
- [x] **Pruebas** con vitest sobre la lógica pura: 37 en `magnet`, `url`,
  `text` y `categories`. Y `npm run verify` = tipos + estilo + pruebas + build
- [x] **CI** en `.github/workflows/ci.yml`, que compila **sin secretos** a
  propósito: la app tiene que arrancar recién clonada
- [x] **`docs/ARQUITECTURA.md`**: dónde vive cada cosa y por qué
- [x] Sin vulnerabilidades: Next 16.2.6 → 16.3.1 y postcss ≥8.5.26 cierran
  tres avisos de severidad alta

### Enlaces magnet

- [x] `src/lib/fuente-propia/magnet.ts`, **sin añadir ningún cliente
  BitTorrent**. Un navegador no puede hablar con la red BitTorrent: los
  clientes normales usan TCP y uTP, y desde una pestaña solo se abre WebRTC.
  Meter WebTorrent serían ~600 KB que pagaría todo el mundo en cada carga para
  un caso que seguiría sin funcionar
- [x] Lo que **sí** funciona y es la razón del módulo: el parámetro `ws=`
  (*web seed*, BEP 19) es una URL HTTP normal del mismo archivo. Cuando un
  magnet la trae, se reproduce directamente
- [x] `resolverFuente()` decide en un solo sitio: enlace normal, magnet con
  réplica, o magnet sin ella —que se rechaza explicando el motivo mientras se
  escribe, no después de guardarlo

---

## Fase 6.4 — Lo que la hoja nueva rompió, y el diseño que faltaba ✅

### Tres regresiones, dos de ellas de la tanda anterior

- [x] **El mosaico de Canales, roto en PC.** `.livetv-columns` tiene **tres**
  hijos —categorías, lista y detalle— y la rejilla nueva solo declaraba dos
  columnas: la lista caía en la estrecha de 420px y el detalle bajaba a una
  segunda fila. Las categorías pasan a ocupar la fila entera
- [x] **Las filas de canal medían 154px en vez de 64.** La caja horizontal es
  `.livetv-row-main` —el botón de dentro—, no el `<article>` que lo envuelve.
  Al no serlo, logo, texto y play se apilaban
- [x] **Las dos barras del teléfono dejaron de estar fijas.** `.app-fade`
  animaba un `transform` con `fill-mode: both`, y un ancestro con transform se
  convierte en el bloque contenedor de sus descendientes `position: fixed`: la
  barra de abajo acababa a 5.500px del viewport. Ahora la transición es solo
  de opacidad
- [x] **Cuatro clases propias sin una sola regla** (`livetv-row-mark`,
  `buscar-teclado`, `player-surface`, `app-fade`). Se encontraron preguntando
  al navegador qué pinta y comparándolo con lo que define el CSS servido, no
  mirando archivo por archivo

### El teléfono

- [x] **El reproductor se metía 41px por debajo de la cabecera.** La regla de
  `.live-slot` en móvil daba por hecho que el hueco lo ponía `.app-shell`, y
  no lo pone. Ahora se mide contra la cabecera real (58px)
- [x] **Ocho destinos en 393px** dejaban cada casilla en 49px con la etiqueta
  partida a «Categoría…». Cinco a la vista y tres tras «Más»: 64px cada uno y
  la etiqueta entera. Las etiquetas no son opcionales aquí — esta app la usa
  gente que reconoce la palabra antes que el icono
- [x] **Pantalla completa en iPhone.** Desde iOS 26 `requestFullscreen` existe
  en el iPhone, así que el orden de intentos se quedaba en él —que no esconde
  las barras de Safari— y nunca llegaba a `webkitEnterFullscreen()`, la única
  vía real. Ahora en iPhone se va directo a esa, y en el resto se **espera**
  cada intento en vez de lanzarlo y olvidarse

### Buscar, en los dos catálogos

- [x] Solo recorría la lista M3U: escribir el nombre de una película no daba
  nada. Ahora hay dos grupos de resultados
- [x] Los canales se filtran **en memoria** (ya están en el cliente) y las
  películas pasan por `/api/buscar`, porque la credencial de TMDB no sale al
  navegador
- [x] Antirrebote de 250 ms y `AbortController`: sin cancelar, la respuesta de
  «bat» podía llegar después que la de «batman» y pintarse encima

### El diseño premium

- [x] **Hero a sangre en Películas** (`hero-destacado.tsx`): arte de fondo,
  título grande y apretado, nota en dorado, línea de datos con puntos,
  sinopsis a tres líneas y dos acciones. Se elige el primer título **con arte
  apaisado**, no el primero a secas
- [x] **Fuera el Tailwind suelto de los estados vacíos**, que eran lo único de
  la app con anillos morados y `bg-white/5`. Un `EstadoVacio` para todos
- [x] El buscador del catálogo, alineado al margen como el resto en vez de
  centrado

### El servidor «Directo»

- [x] `servicios/extractor/` — FastAPI + Playwright, **fuera de la app**: hace
  falta un Chromium de verdad (~400 MB) y tarda 10-30 s, así que no cabe en
  una función sin servidor
- [x] Busca la película por título y año, porque de TMDB no sale la dirección
  del sitio de origen. Elige por título normalizado, no el primer enlace
- [x] **`DOMINIOS_PERMITIDOS` no es opcional**: sin esa lista el parámetro
  `url` convierte el servicio en un proxy abierto capaz de leer
  `169.254.169.254` desde dentro de la red. Comprobado que lo rechaza
- [x] El navegador nunca habla con el extractor: pasa por `/api/extraer`, que
  lee `EXTRACTOR_URL` del servidor. Sin configurar, el botón lo explica
- [x] Caché en memoria de 30 min, un solo Chromium reutilizado, y bloqueo de
  imágenes y hojas de estilo — no se mira la página, solo se siguen enlaces

---

## Fase 7 — Absorber Películas y Series en el shell

Decidido: deja de ser ruta aparte y pasa a ser una vista más, como en ARVIO.

- [ ] `peliculas-view.tsx` dentro del shell, con hero + rieles ya construidos en la Fase 3. `src/components/media/hero.tsx` está escrito y sin usar desde que Inicio pasó a abrir con la señal en vivo: esta pantalla es su sitio natural
- [ ] Ficha de título con el diseño de `DetailsDrawer.tsx` (1.030 líneas): temporadas, episodios, reparto y selector de fuentes
- [ ] `NAV_ITEMS` pasa su entrada de `kind: "link"` a `kind: "view"`
- [ ] `/peliculas` y `/peliculas/[mediaType]/[id]` se conservan como redirecciones para no romper enlaces guardados

**Lo que hay que aceptar al hacerlo:** se pierden las URLs propias de cada
título. El comentario de `app-nav.tsx` ya había descartado esto una vez; la
decisión se revierte a conciencia, a cambio de que la navegación y las
transiciones sean las mismas en toda la app.

---

## Fase 8 — Ajustes

- [ ] `ajustes-view.tsx` → `.settings-shell`, `.settings-panel-card`, `.settings-list-row`, `.set-control`
- [ ] Se porta **la maqueta**, no las 2.776 líneas: la mayor parte de ese archivo son opciones de ARVIO que aquí no existen (cuentas, addons, servidores domésticos, Trakt, Telegram)

---

## Fase 9 — El reproductor

La parte más delicada. Se hace al final a propósito: es lo único que hoy
funciona y que ARVIO no puede reemplazar tal cual.

**Origen:** `components/player/PlayerOverlay.tsx` (1.837 líneas).

- [ ] Portar la maqueta y los controles: `.player-overlay`, `.player-top`, `.player-controls`, `.player-panel-row`
- [ ] **Volver a cablear `use-cast.ts` y `use-watch-party.ts`**, que ARVIO no tiene y son la razón por la que este paso va el último
- [ ] Conservar la carga con `next/dynamic({ ssr: false })` y `serverExternalPackages`
- [ ] Añadir salida con Atrás y Escape: hoy solo se sale con el botón, porque `useSpatialNav` va desactivado en el reproductor

---

## Fase 10 — Cierre

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
