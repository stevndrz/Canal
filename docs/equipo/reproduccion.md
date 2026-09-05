# Memoria: Agente reproduccion

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

---

## Mi zona

```
src/components/stream-player.tsx       El motor de vídeo (HLS/MPEG-TS) del canal en directo
src/components/fullscreen-player.tsx   La pantalla completa de un canal
src/components/native-player.tsx       El reproductor propio de Películas/Series y "Mi enlace"
src/lib/teclas-mando.ts                Teclas del mando que llegan sin nombre (Tizen 4/5)
```

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-09-04 — Velocidad II: vistas bajo demanda

`vista-activa.tsx` traía las 5 vistas por `import` estático y el bundle
inicial las pagaba todas (parrilla EPG, guía, formularios) aunque solo se
pintara Inicio. Ahora `LiveTvView`, `BuscarView`, `FuenteView` y
`AjustesView` van con `next/dynamic` —cada una en su chunk, se descarga al
entrar a su pestaña, una sola vez— y `HomeView` queda estático porque es la
primera pantalla. Fallback mínimo con el mismo armazón (`screen tv-safe`, sin
CSS nuevo) para no pegar saltos de layout. La capa TMDB se revisó y ya va con
caché de días en caliente: tocarla era más riesgo que ganancia.

### 2026-09-04 — Velocidad: poda de iconos, esqueleto propio y hls.js perezoso

Pedido: optimizar velocidad en toda la app. Auditoría previa (dos pasadas:
datos-servidor y bundle-cliente). Lo implementado, todo verificado con
`typecheck` + `lint` + 300 tests + `next build`:

- `next.config.ts`: `experimental.optimizePackageImports: ["lucide-react"]`.
  Treinta y un ficheros importan iconos de la raíz y cada uno arrastraba el
  barril entero a su chunk. Ahora solo viaja el icono usado.
- `src/components/live-card-skeleton.tsx` (nuevo): el esqueleto vivía en
  `live-card.tsx` y `dashboard.tsx` lo importaba estático como `loading` del
  `dynamic()` de `LiveCard` —eso metía `StreamPlayer` y motores al bundle
  inicial y anulaba el `dynamic`. Mismo marcado, archivo propio.
- `native-player.tsx`: `import Hls from "hls.js"` estático → `cargarHls()`
  (nuevo export de `motor.ts`, promesa cacheada) dentro del efecto. Un `.mp4`
  ya no descarga ~580 KB de librería; sin MSE o si la descarga falla, cae al
  `<video>` nativo como antes. Comportamiento idéntico, solo cambia cuándo se
  descarga.

Lo que la auditoría dejó SOBRE LA MESA (no tocado, territorio ajeno o riesgo):
`vista-activa.tsx` trae las 6 vistas estáticas cuando solo se ve Inicio;
`page.tsx`/`peliculas` hacen N+10 TMDB por visita; M3U/EPG se re-parsean por
proceso frío. Si se quiere seguir, ese es el orden por impacto.

### 2026-09-04 — Vimeus muerto por su reproductor «v2» (base href en el proxy)

Reporte: Vimeus decía «no podía reproducirse» y ningún servidor arrancaba
nada manipulable. Medido con curl: el upstream vive y TIENE los títulos, pero
migró a un reproductor «v2» con rutas RELATIVAS (`/player-assets/index-v2.js`,
carátulas `/<hash>.jpg`). Como el iframe carga nuestro HTML proxeado desde
nuestro origen, esas rutas resolvían contra nosotros → 404 → reproductor
muerto. Arreglo en `src/app/api/proxy/vimeus/route.ts`: `fijarBase()` inyecta
`<base href="https://vimeus.com/">` lo primero del `<head>`. Así el JS/CSS
carga directo de ellos (verificado: `index-v2.js` da 200 con 405 KB) y los
`import` relativos del módulo siguen resolviendo —reescribirlos a mano contra
nuestro asset-proxy los habría roto—. Las peticiones a `vimeos.net` siguen por
el asset-proxy vía el guion de runtime, que no se estorba porque
`location.href` no cambia. Verificado en local con dev+curl: proxy 200 con la
base inyectada. `typecheck`, `lint` y los 300 tests limpios.

### 2026-09-03 — Foco directo al reproductor externo en TV (fichas)

Reporte real desde el APK en Android TV: dentro de una peli no se llegaba al
play ni al volumen del reproductor externo (iframe de otro dominio). Límite
honesto que condiciona todo: **desde fuera de un iframe ajeno no se puede
pulsar su play, ni su volumen, ni leer su estado** —ningún botón nuestro puede
controlarlo por dentro—. Lo único que sí se puede es meter y sacar el foco con
eficacia. Todo lo tocado vive en `src/components/catalog/ficha-reproductor.tsx`
(territorio `catalogo`, pero es donde vive el iframe; cambio mínimo y solo-TV)
y va detrás de `enTelevisor`:

- El botón de entrar ya viene enfocado en TV («Manejar el vídeo con el mando»)
  y dice qué va a pasar dentro, incluido que **el volumen sale de las teclas
  de volumen del mando** (las atiende el sistema, también con el foco dentro
  del vídeo: en pantalla no hay nada que seleccionar para eso).
- El botón de reproducir/pausar del mando ENTRA a los controles
  (`accionDeTecla` + `abrirMarco`): una pulsación mete el foco, la siguiente ya
  la oye el servidor. Solo con el marco cerrado y solo en embeds —con enlace
  directo manda `NativePlayer`, que ya las atiende él—.
- Atrás sale de los controles ANTES que del modo cine, en fase de captura con
  `stopPropagation`: `NavegacionCatalogo` se registró antes y sin captura un
  Atrás cerraba controles Y cine de un tirón.
- Con el marco abierto en TV se enseña la salida («Estás manejando el vídeo —
  Atrás para volver a la app» + botón «Volver a la app»), porque con el foco
  DENTRO del iframe ajeno Atrás no llega a la página y sin texto visible no hay
  forma de saber cómo salir.

Sin probar en TV real: sale de leer el código, no de un aparato. Si alguien
hereda esto con un Android TV a mano, confirmar que Atrás dentro del iframe
devuelve el foco a la página (depende del WebView del APK, no de este código)
y que el play del mando entra al primer toque.

### 2026-09-03 — La guía que nunca se cerraba, y el mando peleando consigo mismo

Reporte real con captura: en Canales, con la pantalla completa y la guía
(`GuiaCanales`) abiertas, la tira de canales se quedaba pegada para siempre
—«ya no se quita esto después de los segundos»— y encima izquierda/derecha
parecían cambiar de canal en vez de recorrer la barra.

- **Una sola causa para las dos quejas.** `zap()` llama a `openGuide()` —arma
  un temporizador de 5 s— y justo después `onTune` cambia `channel.id`. Ese
  cambio disparaba el `return` de limpieza del efecto `[channel.id, wake]`,
  que también cancelaba `guideTimer` sin que nadie lo repusiera: la guía se
  quedaba abierta para siempre en cuanto se zapeaba una vez con ella visible.
  Y mientras `showGuide` es `true`, ← y → zapean a propósito (es el diseño:
  con la guía abierta recorren canales) — con la guía atascada, parecía que
  esas teclas habían sustituido a ↑↓ cuando en realidad ↑↓ ya zapeaban desde
  antes. Arreglado separando la limpieza de `guideTimer` a un efecto propio
  que solo corre al desmontar. `openGuide()` ya cancela su temporizador
  anterior antes de armar uno nuevo, así que no hacía falta tocarlo en cada
  cambio de canal.
- **Confirmado con el equipo `canales`** (memoria compartida en
  `canales.md`, mismo archivo `fullscreen-player.tsx`): el esquema ↑↓ zapea /
  ← → recorre-la-barra-o-zapea-con-la-guía-abierta ya estaba bien diseñado
  desde la pasada anterior. El bug de arriba era lo único que lo rompía.
- **`native-player.tsx` (Películas/Series) tenía el mismo tipo de choque**,
  por un motivo distinto: en «modo cine» (TV, `enTelevisor` ya lo enciende
  solo desde antes — no hacía falta tocar eso) el foco cae dentro del
  reproductor, y sus flechas (retroceder/avanzar, volumen) las escuchaba a la
  vez `alTecla` (local, `onKeyDown` de React) Y `useSpatialNav` (global, en
  `window`, para mover el foco por el resto de la ficha). Con el foco
  puesto solo la primera pulsación se sentía bien; la segunda ya competía con
  un salto de foco. Arreglado con `evento.stopPropagation()` en las cuatro
  flechas de `alTecla` —mismo truco que ya usaba el riel de progreso más
  abajo en el mismo archivo, no hacía falta inventar nada—.
- **Los botones de reproducir/pausar/parar del mando no estaban conectados
  en `native-player.tsx`.** Solo tenía atajos por nombre de tecla (`" "`,
  `k`, `f`, `m`...); en Tizen 4/5 y varios Android TV esos botones llegan
  SIN nombre (ver `teclas-mando.ts`, el mismo mecanismo que ya usa
  `fullscreen-player.tsx`). Añadido un `useEffect` con listener en `window`
  —no puede ir en el `onKeyDown` local porque tiene que funcionar aunque el
  foco todavía no haya entrado al reproductor—.
- **Lo que NO cambié, a propósito:** el mapeo de flechas de
  `native-player.tsx` (← → busca ±10 s, ↑↓ volumen) sigue igual. El pedido
  original hablaba de canales —donde ← → e ↑↓ hacían lo mismo por el bug de
  arriba—; en una película ← → para buscar es la convención universal
  (YouTube, Netflix, VLC), y nadie reportó que estuviera mal. Si se quiere
  otro esquema ahí, es una decisión de producto aparte, no un bug.

`npm run typecheck`, `lint` de los archivos tocados y los 300 tests, todos
limpios. Sin probar en una TV real esta vez —el reporte llegó por captura de
pantalla, no por acceso al aparato—.

### 2026-09-02 — Atrás no hacía nada, y la pista en pantalla mentía

Probando el APK en una TV real: el mando no podía salir de la pantalla
completa de un canal salvo llegando al botón "Salir" de la barra —que ya era
difícil de alcanzar—. La pista de teclado que se ve en pantalla decía
«Atrás salir» desde que existe ese texto. Era mentira: la tecla Atrás
(`Escape`, o el código 10009 de Tizen) nunca estuvo conectada a nada en
`fullscreen-player.tsx`.

- Añadido `esTeclaAtras` (exportada desde `use-spatial-nav.ts`, que ya tenía
  la detección por nombre Y por código — Tizen manda 10009 y no "Escape"). Se
  mira al principio del `keydown`, antes que cualquier otro caso.
- Un solo `salir()` para el botón "Salir" de la barra y para Atrás: antes el
  botón tenía su propia lógica de "salir del fullscreen del navegador, luego
  `onExit`" y Atrás no tenía ninguna. Ahora las dos rutas llaman a la misma
  función.
- Recuperado `teclas-mando.ts` de una rama vieja nunca fusionada
  (`claude/white-box-tv-pc-bug-qewtf1`, ver `canales.md`): reproducir/pausar/
  parar y los botones de canal del mando ahora se reconocen también por
  código numérico, que es como llegan en Tizen 4/5 y en varios Android TV.
  Sin nombre, el `switch` por `event.key` no los alcanzaba nunca.

**Sin probar todavía**: `native-player.tsx` (Películas/Series) no tiene
ningún listener de teclado propio — ni Atrás ni las teclas de reproducción
del mando. Todo lo que tiene hoy son los botones con `data-nav`, que sí
navega `useSpatialNav`. Si el mando falla ahí también, es el mismo arreglo
que aquí, sin inventar nada nuevo.

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando.

---

## Lo siguiente

- ~~Llevar `accionDeTecla`/Atrás a `native-player.tsx`~~ — **hecho** (ver
  entrada 2026-09-03). Atrás no hizo falta tocarlo: `NavegacionCatalogo` ya
  lo atendía a nivel de página con `useSpatialNav`. Solo faltaban
  `accionDeTecla` (reproducir/pausar/parar) y cortar la pelea de foco con
  las flechas.
- **Sin probar en una TV real**: los tres arreglos del 2026-09-03 salieron
  de leer el código y una captura de pantalla, no de un aparato. Si alguien
  hereda esto y tiene acceso a un Android TV o Tizen real, vale la pena
  confirmar que la guía se cierra sola y que el mando no compite consigo
  mismo en la ficha de una película.
