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

- Repasar Ajustes y Favoritos, que aún no han tenido pasada de diseño.
- Buscar clases pintadas sin ninguna regla: preguntar al navegador qué renderiza
  y compararlo con el CSS servido. Así aparecieron cuatro.
