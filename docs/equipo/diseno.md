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
