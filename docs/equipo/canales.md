# Memoria de `canales`

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

Mi definición está en `.claude/agents/canales.md`; ahí van las reglas. Aquí va
lo que ha pasado.

---

## Mi zona

```
src/components/livetv/          La pantalla de Canales y sus filas
src/components/live-card.tsx    El reproductor incrustado de Inicio
src/components/stream-player.tsx · fullscreen-player.tsx · player/
src/lib/m3u.ts · epg.ts · channels.ts · categories.ts
src/lib/reproduccion/ · describir-canal.ts
```

**No toco:** `peliculas/`, `lib/catalog/`, `components/catalog/`, ni el CSS.

---

## Decisiones tomadas

- **Cada campo de `Channel` viaja 7.822 veces.** Si se puede calcular en el
  cliente, se calcula ahí. Si es constante, no se manda. Si puede faltar, se
  omite la clave — React serializa `undefined` como el texto `"$undefined"`, y
  eran 700 KB de decir que no hay nada.
- **hls.js y mpegts.js nunca a nivel de módulo.** Tocan `self` y tumban la
  página con un 500. Dos defensas: `serverExternalPackages` y
  `next/dynamic({ ssr: false })`.
- **Logos con `<img>`**, no `next/image`: vienen de cientos de dominios.
- **En iPhone la pantalla completa no cambia de vista.** El cambio desmonta el
  `<video>` y iOS cancela la pantalla completa. Costó tres intentos entenderlo.
- **Elegir un canal no salta a pantalla completa**: sube arriba y lo pone en
  emisión ahí. Decisión de producto.

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-09-02 (tercera pasada) — Arranca en el canal, y una rama entera que se quedó varada

Motivo: probando el APK real en una TV, «es imposible moverme con los
controles de la app y del reproductor». Dos cosas, no una.

- **`esTelevisorUA` (ya existía, decidido en el servidor) ahora también
  decide la vista de arranque** en `dashboard.tsx`: en un navegador sigue
  Inicio, en el cascarón de un televisor arranca directo en el canal a
  pantalla completa. Atrás sigue llevando al menú entero — no se quita nada,
  solo cambia la puerta de entrada. `esTV` viaja como prop desde
  `app/page.tsx` (con `headers()`) y no se lee `navigator` en el cliente:
  hacerlo así habría hidratado Inicio en el servidor y pantalla completa en
  el cliente, un fallo de hidratación de una rama del árbol entera.
- **El hallazgo real**: había una rama —`claude/white-box-tv-pc-bug-qewtf1`—
  con seis commits *después* de su propio PR ya fusionado, que nunca llegó a
  `main`. Ahí vivían `teclas-mando.ts` (códigos de mando para Tizen 4/5,
  donde `event.key` llega "Unidentified") y `salir-de-la-app.ts` (Atrás en
  Inicio cierra la app, no se queda sin salida). Se rescataron tal cual, con
  sus pruebas — pero **no** su versión de `handleBack`/dígitos, que en esa
  rama era anterior a `useMarcado` y lo habría hecho retroceder.
- **Un bug de verdad, ni siquiera en la rama vieja**: la pista en pantalla de
  `fullscreen-player.tsx` decía «Atrás salir» desde siempre y era mentira —
  esa tecla no estaba conectada a nada. Ver `reproduccion.md`.

`npm run typecheck`, `lint` de los archivos tocados y los 300 tests, todos
limpios. Verificado con Playwright y un User-Agent de Android TV simulado:
arranca en el canal, Escape saca a Inicio con el menú completo, y sin ese
UA la web sigue exactamente igual que antes.

### 2026-09-02 — Pasada de mejoras: accesibilidad, esqueleto, navegación de horas, recientes

Cinco cambios, cinco commits:

- **ARIA en las tres barras de progreso de programa** (`channel-row.tsx`,
  `panel-canal.tsx`, `player/panel-emision.tsx`): `role="progressbar"` +
  `aria-valuenow/min/max`. El dato ya se calculaba con `porcentajeDelPrograma`;
  solo faltaba exponerlo. Cero cambio visual, verificado con `npm run build`.
- **Esqueleto de carga en `ParrillaEpg`.** El estado `"cargando"` no tenía UI
  propia y cae en el mismo render que `"listo"` con `porCanal` vacío: cada fila
  mostraba un hueco en blanco indistinguible de "este canal no tiene guía".
  Ahora, mientras se espera la primera respuesta, cada fila pinta lo que ya se
  sabe de verdad (logo y nombre, que vienen con la lista) y solo la franja de
  horario lleva `animate-pulse` de Tailwind — mismo patrón que
  `LiveCardSkeleton`: lo conocido se pinta, lo que falta brilla.
- **Navegación de horas en la parrilla.** `/api/guia` ya aceptaba cualquier
  `desde` dentro de ±7 días; la UI estaba fija a la franja anclada al reloj.
  Añadidos botones anterior/siguiente y "Ahora" (que reaparece solo si te has
  movido). La cuenta de hasta dónde se puede navegar vive en `moverFranja()`
  (`lib/parrilla.ts`), probada aparte — es donde se decide el límite, y un
  error ahí no avisa en compilación, solo en un botón que deja de moverse sin
  explicar por qué.
- **"Ahora" en la guía flotante** (`player/guia-canales.tsx`): una línea con
  `canal.currentProgram` bajo cada tarjeta del riel, mismo dato que ya usa
  `channel-row.tsx`. Sin porcentaje ni reloj: la tarjeta es angosta para una
  barra legible a tres metros. Queda anotado que la línea nueva sale con el
  mismo tono que el nombre —reutiliza `.guia-canal p` + `.is-muted`, y la
  primera regla es más específica y gana el color—; si se quiere distinguirlas
  de verdad hace falta que diseño meta una clase propia.
- **Fila de "vistos recientemente" en Canales**, no solo en Inicio. Reutiliza
  el mismo `MediaRail` compacto que "Seguir viendo" de `home-view.tsx` — nada
  nuevo que mantener. Ídem, anotado para diseño: `MediaRail` pone su propio
  `padding-left` asumiendo que vive directo en `.screen` (que no tiene relleno
  horizontal); dentro de `.livetv-shell`, que ya lo tiene, la fila queda un
  `--margen` más metida que la cabecera. No rompe nada, pero no queda a ras.

**Un susto operativo que vale la pena dejar escrito:** mi `cwd` de esta
sesión apuntaba a `.worktrees/agente-catalogo` —el worktree del agente
`catalogo`, no el mío—, y había un proceso de ese agente trabajando ahí *en
paralelo*: mi primer `git checkout -b` le cambió el `HEAD` bajo los pies
mientras corría su `npm run verify`, y el suyo me lo devolvió a mí a los
pocos minutos. Antes de tocar nada até de corto tres edits ya hechos con
`git checkout -- <archivos>` para no dejar mis cambios mezclados en su
working tree, y me mudé al worktree correcto (`.worktrees/agente-canales`,
rama `agente-canales`) para rehacerlo todo ahí. `git worktree list` lo deja
claro: un `+` delante de una rama significa que está checked out en OTRO
worktree — si el mío no coincide con la carpeta en la que estoy, algo va mal.
Quien herede esta sesión: comprobar `pwd` contra `git worktree list` **antes**
del primer commit, no después del primer `git status` raro.

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando.

---

## Lo siguiente

- `stream-player.tsx` (8,64) y `fullscreen-player.tsx` (8,29) siguen marcando
  *Large Method*. Coordinar con `calidad` antes de tocarlos.
- ~~La parrilla de la guía EPG sigue aplazada~~ — **hecha**. Conmutador
  Lista/Parrilla en la cabecera de Canales, con la lista por defecto porque es
  la que funciona siempre (la parrilla necesita `EPG_URL`, y el caso por defecto
  de esta app es no tenerla).

  Lo que hubo que resolver, por si toca tocarla: la programación de varias horas
  **no puede viajar con la lista** —`Channel` no puede engordar, cada campo va
  7.822 veces—, así que se pide por ventana de canales a `/api/guia`, que
  responde en tuplas. Las cuentas están en `lib/parrilla.ts`, probadas aparte;
  lo que más cuesta de una parrilla no es la rejilla sino los tres casos de
  borde: lo que empezó antes de la franja, lo que sigue después, y los huecos
  de guía, que hay que dibujar o dos programas seguidos parecen uno.

  En `parrilla-epg.tsx` **no hay ni un `gap`**, a propósito: en webOS y Tizen
  vale cero. Separación con margen y borde.

- **Backlog sin construir, solo anotado** (pedido explícitamente así):
  - *Picture-in-picture.*
  - *Persistencia del nivel de volumen*, no solo el silencio — hoy
    `recordarSilencio` solo guarda mudo/no-mudo (ver `dashboard.tsx`).
  - *Recordatorios de programa.*
  - *Búsqueda de "qué están dando" entre todos los canales* — necesita
    decisión de producto antes de tocarla: un endpoint nuevo que recorra la
    guía de 7.822 canales tiene un coste real, y no es solo un `filter` más
    sobre lo que ya viaja. Plantear antes de construir.
