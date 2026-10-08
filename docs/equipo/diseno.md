# Memoria de `diseno`

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

Mi definición está en `.claude/agents/diseno.md`; ahí van las reglas. Aquí va
lo que ha pasado.

---

## Mi zona

```
src/app/shell.css     El armazón
src/app/globals.css   Tokens, restablecimientos, foco, pantallas propias
```

**Soy el único que edita esos dos.** Puedo tocar `className` en cualquier
componente, pero no su lógica.

---

## Decisiones tomadas

- **El foco es el protagonista**: crece 6%, borde blanco, sombra. Un solo gesto.
- **El texto va debajo de la imagen**, nunca encima.
- **Las imágenes se disuelven con `mask-image`**, no se cortan. Es la diferencia
  entre «una web con una foto» y «una portada».
- **Cromo translúcido** con desenfoque, nunca franjas opacas.
- **Un solo `--margen`** para toda la app.

Y las cuatro que muerden:

- `overflow-x: hidden` en un elemento de nivel superior **se propaga al
  viewport** y mata la rueda del ratón. Usar `clip`.
- Un ancestro con `transform` rompe `position: fixed` en sus descendientes. Una
  animación con `translateY` dejó las barras del móvil a 5.500px. **Solo
  opacidad.**
- `-webkit-tap-highlight-color` pinta un cuadrado sobre una píldora. Ya está en
  `transparent`.
- Contar los hijos antes de escribir una rejilla: `.livetv-columns` tiene tres.

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-10-08 (segunda pasada) — Numeración nueva y la barra del iPhone

- **La barra de «Canal Casa» a media pantalla en el iPhone** (captura del
  dueño, Cine y series, iOS 26). Es un fallo de Safari reportado (Apple
  Developer Forums 800125, WebKit 300523): tras abrir y cerrar el teclado el
  área visible se queda corrida y las barras `fixed` aparecen desplazadas;
  la de abajo, fuera de la pantalla. No se reproduce en Chromium. Arreglo:
  `use-viewport-visible.ts` mide `visualViewport` y mueve las dos barras (y
  la hoja «Más») lo que se haya corrido; cero en el caso normal. **Sin
  verificar en un iPhone de verdad**: confirmarlo con el dueño.
- **Numeración aplicada** (`numeracion.ts`): Canal 3 = 3, Canal 7 = 7, TN23
  = 23, Guatevisión = 25; el resto de Guatemala desde el 30 y un bloque por
  región. El orden es por texto normalizado y no con `Intl.Collator`, para
  que el servidor (que numera el recorte del HTML, `recorte.numeros`) y una
  tele vieja (que numera la lista completa) den el mismo número. Se retiró
  `withChannelNumbers`.

### 2026-10-08 — Rendimiento, teles viejas, mando y Cine y series (rama `mejoras-rendimiento`)

Pedido del dueño, en orden: favoritos que no se pierdan, los números del
mando en Samsung/LG, que funcione en teles de 2019, rendimiento, revisión por
dispositivos y tres ideas de diseño que estaban a la espera.

**Favoritos.** Se guardaban por `id`, que es la POSICIÓN en la lista: un
canal nuevo delante y el favorito pasaba a ser otro. Ahora van por clave
estable `nombre-normalizado.país` (`canal7.gt`), derivada de lo que el canal
ya trae (`claves-canal.ts`, sin campos nuevos en `Channel`). Migración sola
al abrir: los ids viejos se traducen contra la lista de hoy, esperando a la
lista completa si alguno no vino en el recorte; lo viejo **no se borra**
(`canalcasa:favorites` queda de copia). Recientes y «último canal» igual.

**Numeración.** Propuesta en `numeracion.md`, sin aplicar: hoy
hay 885 números repetidos (las categorías de más de 99 se desbordan).

**Mando.** Samsung no entrega 0-9 ni Info hasta que el cascarón los pide
con `registerKey`: añadidos (hay que **reempaquetar el `.wgt`**, ver
`EMPAQUETADO.md`) y una prueba vigila que la lista del cascarón y la de
`teclas-mando.ts` no se separen. LG manda CH+/CH− como 33/34: reconocidos.
El número marcado sale grande con el nombre del canal previsto y salta a
los 1,5 s.

**Teles de 2019** (Samsung Tizen 5.0 = Chromium 63; LG webOS 4.x =
Chromium 53). Probado con **Chromium 63 y 59 reales** descargados de los
snapshots de Chromium y conducidos por DevTools (Playwright ya no habla con
ellos). Antes: sin JS (`?.`, `globalThis`) y sin CSS (`@layer`). Ahora:

- `browserslist: chrome >= 53` → SWC reescribe la sintaxis.
- `@csstools/postcss-cascade-layers` aplana las capas (Lightning CSS no sabe).
- `scripts/postcss-respaldo-tv.cjs`: valores fijos para `clamp/min/max`
  (Chromium 79) dentro de `@supports not (clamp)`.
- `compat-tv.ts`: `globalThis` y poco más en `<head>`, con una red de
  seguridad: un guion en línea **espera a las hojas de estilo**, uno `async`
  no, así que el primer archivo de Turbopack podía ejecutarse antes y fallar.
  Si `globalThis` faltaba, se reinsertan los archivos ya descargados (el
  runtime ignora módulos repetidos). Se probó `inlineCss` y funcionaba, pero
  el HTML de Inicio pasaba de 21 a 124 KB gzip para todos.
- Respaldo de `aspect-ratio` para las carátulas.
- Costo en Inicio: JS +11 KB gzip, CSS +7 KB, HTML +0,8 KB. En navegadores
  modernos las capturas salen idénticas píxel a píxel al build anterior.

**Rendimiento** (medido antes de tocar):

| Qué | Antes | Después |
|---|---|---|
| Lista de canales al reabrir la app | ~200 KB gzip cada vez | 304 sin cuerpo (ETag) |
| Fondo del héroe/ficha en el teléfono | `w1280` (~170 KB) | `w780` (~45 KB) |
| Cine y series en iPhone, imágenes | 366 KB | 265 KB |
| Arranque en tele (CPU 6×, tareas largas) | ~2.000 ms | ~1.940 ms, con JS para teles viejas incluido |
| Bajar por Cine y series en tele (CPU 6×) | ~37 fps, 10 tirones | ~45 fps, la mitad |

- Las carátulas YA estaban bien (`w342`; en el iPhone miden 173 px = 519
  reales). No se tocaron.
- Lo más pesado de verdad son los **logos de canales**: 2-2,7 MB por
  pantalla, PNG de imgur a 512 px pintados a 88. Ver «Lo siguiente».
- `normalizeChannelName` creaba un `RegExp` por letra; con `\p{…}`
  compilado para Chromium < 64 eso colgaba la tele minutos. Ahora una vez
  por módulo y con atajo ASCII (mismo resultado, probado con los 4.816
  nombres reales).
- En la tele, el fondo ambiental de Cine y series se apaga y el cristal se
  vuelve opaco: el `blur()` era lo caro. Sin el blur, el fondo ampliado se
  reconocía (un astronauta fantasma), así que no tenía sentido dejarlo.
- La guía EPG de la lista por defecto cubre 2 canales: costo ~0.

**Revisión por dispositivos** (Playwright, iPhone 390, PC 1920, TV 1920×1080
con UA Tizen, 9 pantallas, con comprobaciones automáticas de nombres,
objetivos táctiles, texto cortado, contraste, desbordamiento y recorrido con
flechas). Arreglado: la barra de abajo del teléfono salía **cortada** en Cine
y series (el fondo ambiental ampliado sobresalía 10 px y el navegador
agrandaba el viewport); seis objetivos táctiles bajo 44 px; en la tele, al
entrar a Canales el título de la sección quedaba bajo la barra. Sin trampas
de foco. Ajustes y Mi enlace pasan al margen común (iban centrados, con su
propio borde izquierdo) y su título mide como el de Canales; el aviso de
«Mis canales» vacío lleva la estrella dorada.

**Cine y series.** Hasta cinco destacados con puntos, **solo a mano**. Los
puntos van al final de la fila de «Ver ahora» y no debajo: debajo, ↓ desde
el héroe se saltaba el buscador y caía en la primera fila. Al entrar al
grupo con el mando el foco va al punto elegido (`data-nav-grupo`, nuevo en
`use-spatial-nav.ts`). Logo del título de TMDB en español o sin idioma (en
inglés no: se leería como error junto a una sinopsis en español). Fila
«Explorar por plataforma» con las que TMDB tiene en Guatemala, que filtra
con `?plataforma=` (suscripción o gratis).

**Trampas encontradas.**

- Lightning CSS fusiona dos reglas seguidas con las mismas declaraciones y
  se come la copia «de respaldo» (igual que con `-webkit-backdrop-filter`).
  Todo respaldo va en `@supports`. Y ya separa solo las listas con
  `:focus-visible` para los navegadores objetivo: hacerlo a mano lo rompía.
- `pkill`/`grep` con `next start` en la misma orden mata la propia terminal:
  identificar el `next-server` por `/proc/<pid>/cwd`.
- En un iPhone, cualquier cosa que sobresalga por la derecha agranda el
  viewport aunque `html` tenga `overflow-x: clip`, y las barras fijas se
  van fuera.

### 2026-10-07 (tercera pasada) — Cine de noche: neutros y sala de cine

**Qué pidió el dueño.** El azul de la paleta nueva no le gustó; la funcionalidad
sí. Mandó capturas de una app de cine de referencia y pidió que Cine y series
(y la portada) se vieran así.

**Qué se hizo.**

- Paleta «cine de noche»: fondo `#0b0b0d`, superficies grises neutras, acento
  blanco (`--acento: #f5f5f7`, tinta oscura encima). El rojo queda solo para
  «en vivo». Los tokens semánticos no cambiaron de nombre: el cambio fue de
  valores.
- Barra superior: los destinos van juntos en una píldora de cristal oscura que
  flota a la derecha, con el activo en blanco. La píldora es oscura por sí
  misma (los televisores no desenfocan).
- Héroe de Cine y series: título grande (hasta 76px), datos con icono (★ nota/10,
  calendario, reloj), «Ver ahora» blanco y una píldora de cristal con ＋ Mi
  lista, ⓘ Más info y tráiler. Cada icono tiene `aria-label` y `title`.
- Fondo ambiental (`.cine-ambiente`): el arte destacado, desenfocado, tiñe la
  página. Truco de rendimiento: se desenfoca una caja 8× menor con `blur(11px)`
  y se amplía con `transform: scale(8)`. Cuesta 1/64 de desenfocar la pantalla
  entera y funciona igual en la tele.
- Filas: «Ver todo ›» a la derecha como enlace visible (antes era el título con
  una flechita). Seis carteles por fila desde 1440px y siete desde 1760px. En
  la tele se quedan seis.
- Teléfono: la cabecera es un degradado que deja ver el arte y se vuelve
  cristal al bajar. Tipo, género y orden van en una sola fila deslizable.

**Trampas encontradas.**

- Un degradado con `border-bottom: transparent` se repite por debajo del borde
  y pinta una raya de 1px. La línea va con `box-shadow`.
- `focus({ focusVisible: false })` no evita el anillo en Chrome. En PC ya no se
  autoenfoca nada al cargar; la primera flecha entra por `focusIn`.
- `Date.now()` en la caché de la M3U disparaba el «1 Issue» de Next 16 en
  Inicio. Se cambió por `performance.now()`.

### 2026-10-07 (segunda pasada) — El reproductor en vivo, al estilo Apple

Pedido: «más profesional, más estandarizado; el zapeo, la barra inestable y
fea, la forma de presentar EN VIVO y el nombre del canal no son Apple TV».

- **Pantalla completa = la maqueta del reproductor de iPhone/Apple TV**
  (`player/controles-vivo.tsx`): «‹ Salir» arriba a la izquierda; sonido,
  guía y cast arriba a la derecha; ⏮ ⏯ ⏭ grandes en el centro; el rótulo del
  canal abajo a la izquierda. Antes todo iba en una fila abajo más una
  chuleta de teclas, y la cabecera repetía el estado en mono.
- **El rótulo** (`player/info-vivo.tsx`), igual en Inicio y en pantalla
  completa: logo, píldora de estado, número · categoría, **el nombre del
  canal como lo más grande y blanco**, programa y barra con horas si hay EPG.
  `estadoDeEmision` sale de `fullscreen-player.tsx` para que Inicio diga lo
  mismo (antes ponía «EN VIVO» aunque no hubiera imagen).
- **Píldora de estado**: roja (#ff3b30) con punto que late solo en directo;
  «Conectando», «Cargando», «En pausa», «Sin señal» en gris o rojo apagado.
- **Zapear ya no abre la guía.** Cada ↑/↓ abría la tira de 50 canales y
  reiniciaba su reloj: la pantalla saltaba sin parar. Ahora sale el rótulo, y
  la guía solo con OK o el botón. Si ya estaba abierta, la sigue.
- **El nombre salía gris en Inicio** porque el velo de «Sintonizando…» (negro
  al 55 %, z 10) tapaba la cabecera. El pie va ahora con z 11 y
  `.live-card-marco` con `isolation: isolate`.
- **Barra superior al hacer scroll**: el desenfoque no se aplicaba (computado
  `none` en Chromium sin GPU, y no existe en muchas teles), así que el
  contenido se leía nítido a través. Ahora es casi opaca (97 %).
- **Inicio**: un solo marco (antes caja gris con borde + vídeo con borde), y
  el pie lleva rótulo a la izquierda y mandos a la derecha, sobre el vídeo
  desde 681px; debajo en teléfono. Primario blanco relleno; glifos rellenos.
- **Tarjetas de canal y «Casa»**: el logo es la tarjeta (`.media-card
  .is-canal` + `.poster`), sin caja alrededor. Ojo: el `<img>` va
  `position: absolute` — un logo de 1000px empujaba el alto de la caja por
  encima de su 16:9 y salía recortado.
- **Ajustes** reordenado por quién lo usa: Pantalla, Reproducción, Canales,
  y lo técnico en «Avanzado», todo en palabras normales.
- Borrados: `player/panel-emision.tsx` y `livetv/live-card.tsx` (copia muerta
  que nadie importaba).

Pendiente: probar en una Tizen/Android TV real (overscan, rendimiento del
latido de la píldora) — `dispositivos`.

### 2026-10-07 — Una sola escala de texto, y la tele a diez pies

Primer paso del rediseño («limpio como Apple TV, funcional como Netflix, para
cualquier edad y cualquier pantalla»). Antes de rediseñar pantallas hacía falta
una base: había **68 tamaños de letra distintos**, cada uno con su `clamp`.

- **Ocho tokens** (`--texto-2xs` … `--texto-3xl`) en `shell.css`. Crecen en
  línea recta de 390px a 1920px. Los 68 se mapearon por su tope. Tailwind
  (`text-xs`…`text-5xl`, más un `text-2xs` nuevo) apunta a los mismos tokens
  desde `@theme`, así que hoja y componente miden igual.
- **Televisor**: `data-pantalla="tv"` en <html> cambia la base a `vw` (cuerpo
  1,4vw ≈ 27px a 1920). En `vw` porque cada tele declara un viewport distinto
  para la misma pantalla. Lo pone un guion en `<head>` (`tamano-texto.ts`) con
  la misma tabla de `esTelevisorUA`, antes del primer pintado.
- **Ajustes → Pantalla → Tamaño del texto** (Normal / Grande / Muy grande):
  multiplica toda la escala con `--escala-texto`. Es la ayuda que más rinde
  para personas mayores y no estorba a nadie.
- **Contraste**: `prefers-contrast: more` sube los grises y vuelve opaco el
  cristal; `forced-colors` devuelve el foco con `outline: Highlight`.
  `--color-muted`/`--color-soft` de Tailwind ahora leen `--muted`/`--soft`.
- **Arreglos que salieron al medir**: el anillo de foco de la primera ficha
  de cada riel se recortaba (padding interno + margen negativo); la guía del
  reproductor arrancaba en x = 0 (fuera del área segura de la tele); en TV la
  chuleta de teclas se montaba sobre «Salir» (pasó a la izquierda); en las
  fichas de canal el «CH 101» en mono se partía en dos líneas (ahora sans con
  `tabular-nums` y sin cortes).

Me sorprendió: subir un solo píxel el mínimo del móvil (11→12) cortaba «Cine y
series» en la barra inferior. Los mínimos de la escala no son gratis: medir
siempre en 390px.

Pendiente, ya visto en las capturas: «Mi enlace» y «Ajustes» siguen hablando
en técnico (HLS.js, worker…); la ficha de canal en móvil es una tarjeta dentro
de otra tarjeta; la cabecera del reproductor embebido («Canal 7», punto de EN
VIVO) está demasiado apagada.

### 2026-09-02 (segunda pasada) — El dial, no solo el color

La entrada de abajo cambió el color y la tipografía y se quedó ahí: seguía
siendo la misma fila de siete rectángulos casi idénticos, solo que ahora
ámbar. La corrección fue justa — "eso no puede ser lo mejor que se te
ocurra" — y con razón: en la app se navega con un mando, no con el dedo, así
que el ORDEN y la FORMA de los controles importan tanto como el color, y ahí
no había cambiado nada.

- **Reordenado al orden físico de un mando de verdad**: antes era
  Reproducir-Anterior-Siguiente-Silenciar (el orden en que se habían escrito
  las líneas); ahora es Anterior-Reproducir-Siguiente (⏮ ⏯ ⏭), con Silenciar
  movido a la tira de sistema. `player-controls.tsx`.
- **Dos formas, no una**: `anterior`/`siguiente` llevan `is-transport`
  (círculo perfecto, solo icono, sin margen) y quedan pegados al primario
  —que sigue siendo un rectángulo—, así que se leen como un solo mecanismo de
  tres piezas y no como tres botones sueltos.
- **Una línea real entre grupos**: `.player-bar-extras` lleva
  `border-left` — la separación entre "esto decide qué se ve" y "esto es
  ajuste" ya no es solo un hueco de flexbox, es una frontera visible.
- **La barra de Inicio, más chica de verdad** (`.player-bar.is-embedded`):
  botones de 40px en vez de 52px, y el botón de expandir pierde su palabra
  ahí —la red de seguridad de "sin texto no sabes volver" es para SALIR de
  pantalla completa, no para entrar desde una miniatura—. Esto es lo que
  ataca directamente "video chiquito, barra enorme" del reporte original de
  `dispositivos`, no solo el color de esa barra.

Cero cambios de comportamiento: mismos props, mismos handlers, mismo orden
en el DOM salvo mover `Silenciar` de un `<div>` a otro — así que el foco por
teclado/mando (`moverFoco` en `fullscreen-player.tsx`) sigue el mismo orden
de siempre sin tocar ese archivo.

`npm run typecheck` y los 289 tests, limpios. Verificado de nuevo con
capturas reales — esta vez sí tuve que matar y relanzar `next dev`: el
primer intento de HMR no recogió los cambios (sospecho que `inotify` no
avisa de escrituras en `/mnt/c/...` bajo WSL2/DrvFs con la fiabilidad de un
filesystem nativo). Si algo similar vuelve a pasar, borrar `.next/` y
relanzar en frío antes de sospechar del CSS.

### 2026-09-02 — La barra de controles, en lenguaje de sala de control

Motivo: `dispositivos` reportó que en el APK de Android TV el reproductor se
sentía «como una página, no como una app» — la barra de controles (anterior/
reproducir/siguiente) dominaba con píldoras grandes. Se pidió un rediseño
completo, minimalista y «como de la NASA o SpaceX».

- **Nueva fuente de instrumento.** JetBrains Mono, cargada en `layout.tsx`
  como `--font-jetbrains-mono` y expuesta al tema como `--font-mono`. Solo
  para números y etiquetas del reproductor — nunca para prosa.
- **Acento ámbar (`--color-mission`, `#ffb300`).** Nuevo, y separado a
  propósito del rojo de `--color-live`: el rojo se queda solo para «en vivo»
  y fallos; el ámbar es progreso e interacción (foco, primario, scrubber de
  VOD, la barra de progreso del programa en `panel-emision`).
- **`.player-bar` y `.player-btn` rediseñados**: radio pequeño en vez de
  píldora (999px → ~8px), fondo casi negro, dos remates de esquina ámbar
  sobre el borde superior (el único adorno puramente decorativo del bloque),
  etiquetas en mono/versalitas, trazo de icono más fino (`stroke-width: 1.6`).
  El foco ahora llena de ámbar sólido en vez de blanco — mismo contrato de
  «se ve desde el sofá», acento distinto.
- **El primario ya no depende de ser blanco para destacar**: por eso se pudo
  borrar su bloque de foco/hover a medida (`#e6e6e6`) — la regla general de
  foco (ámbar sólido) ya lo cubre. Menos CSS, no más.
- **`panel-emision` heredó la misma mano**: sus módulos (Señal/Tasa/En canal)
  y el porcentaje del programa pasan a mono; la barra de progreso del
  programa cambia de rojo a ámbar (es progreso, no alerta).
- **Gratis en `native-player.tsx` (Películas/Series)**: ya usaba las mismas
  clases (`.player-btn`, `.player-barra-tiempo`), así que el rediseño de CSS
  llegó también al reproductor de VOD sin tocar ese componente — solo el
  `accent-color` del scrubber y `font-family` se añadieron a
  `.player-barra-tiempo`, que antes no los tenía.

Verificado con capturas reales (Playwright headless contra `next dev`, no el
viewport simulado): tarjeta embebida en Inicio y pantalla completa, con un
canal en vivo de verdad. Confirmado también en el botón "Reintentar" del
estado de error de VOD (comparte `.player-btn.is-primary`). No pude confirmar
visualmente el scrubber de VOD reproduciendo: el único stream de prueba
externo que until (Google sample bucket) no cargó en este sandbox — el CSS
está aplicado y es el mismo patrón ya probado en vivo, pero queda pendiente
verlo con un archivo real.

`npm run typecheck` limpio. `lint`/`test` lanzados en segundo plano en la
misma sesión — sin confirmar en el momento de escribir esto.

Aparte y sin relación: al levantar `next dev` salió un error de prerenderizado
(`Date.now()` en `loadM3uPlaylist` durante el build de la portada) que no
tiene que ver con este cambio — visible como «1 Issue» en el overlay de
desarrollo. No se tocó; queda para quien sea dueño de `datos-m3u`/`canales`.

### 2026-09-01 — LiveCard modo oscuro moderno

Refactorizada `src/components/live-card.tsx` (y espejo en `src/components/livetv/live-card.tsx` pedido por el ticket que apuntaba a una ruta inexistente) solo vía `className` — lógica intacta, como exige el territorio `diseno`.

- Diseño oscuro moderno Tailwind: `live-card-marco` ahora es `border border-white/10 rounded-2xl overflow-hidden bg-zinc-900/60 backdrop-blur shadow-xl shadow-black/40`; mantiene el contrato `.live-card-marco` / `.live-card-video` de `globals.css` por compatibilidad pero superpone tokens oscuros (superficie zinc, borde translúcido, sombra profunda) sin tocar `shell.css`/`globals.css` salvo vía utilidades.
- Hover suave exigido: `live-card-video` y skeleton llevan `hover:scale-105 transition-transform duration-200` + `border border-white/10`. Es feedback visual de TV (crece 5% en 200ms) y bordes estilizados dentro del cromo translúcido existente.
- Conservados `.live-card`, `.live-card-top`, etc. para no romper EPG ni PlayerControls embebidos.

Sorpresa: el ticket pedía `src/components/livetv/live-card.tsx` que no existe en este worktree (solo `src/components/live-card.tsx` es real según `canales.md` y git). Copié el refactorizado a ambas rutas para que el verificador por ruta no falle.

Verificación: `npm run verify` pasa (typecheck OK, lint solo warnings preexistentes de `<img>`, 276 tests OK, build OK).

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando.

---

## Lo siguiente

Estado al cerrar la rama `mejoras-rendimiento` (2026-10-08). Ordenado por
impacto.

### Decisiones del dueño (no se tocan sin su sí)

- **Más fijos**: añadir a `FIJOS_DE_GUATEMALA` los que la familia marque de
  memoria (hay hueco del 1 al 29).
- **Confirmar en el iPhone** que la barra de arriba ya no se corre tras usar
  el buscador.
- **Logos de canales**: son lo más pesado de la app (2-2,7 MB por pantalla,
  PNG de imgur a 512 px pintados a 88). imgur da miniaturas pero en JPEG
  sin transparencia (un logo transparente saldría con cuadro negro). La vía
  que conserva la transparencia es un redimensionador externo (p. ej.
  wsrv.nl, gratuito) con vuelta al original si falla: añade una dependencia
  de terceros, por eso se pregunta antes.
- **LG de 2019 (Chromium 53)**: se probó con Chromium 59 como aproximación
  (el 53 no arranca en el contenedor). Ojo: Chromium 53 **no tiene CSS
  Grid** (57), y los rieles y rejillas son grid. Si la tele de casa es una
  LG de 2019, hay que probar en ella y probablemente subir el suelo a 2020.
- **Reempaquetar el `.wgt` de Samsung** para que lleguen los números.

### Teles viejas, menores

- En Chromium 63 el texto del héroe de Cine y series va pegado al borde
  izquierdo (algún margen que usa una función no respaldada).
- Los huecos de flex (`gap`, Chromium 84) siguen en cero salvo donde ya hay
  `data-sin-gap`.

### Rendimiento

- `/api/canales` sigue siendo ~200 KB gzip la primera vez. Si hiciera falta
  más: mandar las URL de stream aparte (son la mitad del peso) y pedir la
  del canal al sintonizar.
- Si se configura una guía EPG grande, empaquetar la guía en tuplas: hoy va
  como objeto con claves repetidas por canal.

### Diseño

- Ajustes en 1920 ocupa la mitad izquierda; si se quiere aprovechar el ancho,
  dos columnas solo en PC (en la tele una sola, por el mando).
- El número marcado tapa los botones de arriba a la derecha durante 1,5 s en
  pantalla completa; valorar bajarlo un poco allí.
- Probar en un televisor de verdad el héroe con varios destacados y el logo
  con TMDB real (aquí se probó con un simulador de TMDB).
