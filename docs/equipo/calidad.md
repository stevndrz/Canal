# Memoria de `calidad`

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

Mi definición está en `.claude/agents/calidad.md`; ahí van las reglas. Aquí va
lo que ha pasado.

---

## Mi zona

Todo el repositorio, **solo con cambios que no alteran comportamiento**.
Si un refactor exige cambiar lo que la app hace, va a su dueño.

---

## Decisiones tomadas

- **No estimar hotspots: pedir la lista real del panel.** Una estimación casera
  por tamaño × frecuencia apostó por `title-detail.tsx` (466 líneas). Era
  `epg.ts`, con 157. El modelo no premia que un archivo sea corto: lo que hunde
  la nota es el *Bumpy Road*, varias secciones de lógica anidada seguidas.
- **Un refactor por commit**, y `npm run verify` después de cada extracción.
- **Capturar qué pinta una pantalla antes de tocarla** y comprobar que después
  sale lo mismo.
- **jsdom no**: los componentes se verifican con Playwright contra la app real.
  Ninguno de los fallos reales de este proyecto lo habría cazado jsdom.
- **`no-unused-vars` en error.** El preajuste de Next no la trae; encontró diez
  símbolos muertos el primer día.
- **El CI compila sin secretos** a propósito: la app arranca recién clonada.

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-09-02 — Auditoría tras las tres oleadas de rediseño del reproductor

Pedido: auditar lo que dejaron los commits recientes del reproductor (proxy
anti-anuncios de Vimeus, barra estilo Apple TV, reescritura de
`native-player.tsx`) — código basura o duplicado, vulnerabilidades,
dependencias. PR: [#28](https://github.com/stevndrz/Canal/pull/28), rama
`agente/calidad/globals-css-dead-code`.

**Antes/después medido por especificidad CSS, no por CodeScene** (no volví a
pedir el panel esta sesión): `globals.css` pasó de 3795 a 3722 líneas.

**Lo que encontré y arreglé — `globals.css`, dos tallas para el mismo botón:**
`.player-bar.is-fullscreen .player-btn` y su variante `.is-primary` tenían DOS
declaraciones de ancho/alto con la MISMA especificidad y sin `@media` de por
medio: una cerca de la cabecera del archivo (48px/62px) y otra en el bloque
"Tamaños finales de la botonera" más abajo (52px/64px). La segunda gana
siempre por orden de cascada — los 48px/62px nunca se pintaron, pero
quedaban ahí mintiendo a quien leyera el archivo de arriba a abajo. Es
exactamente el patrón que ya motivó consolidar `.player-bar.is-embedded
.player-btn` en una sesión anterior: tres oleadas de rediseño (mission
control/ámbar, Apple TV/cristal, la reescritura de `native-player.tsx`)
tocando el mismo archivo sin coordinarse dejan este rastro. **Quien toque
`globals.css` a continuación debería grepear por selectores duplicados antes
de dar por buena la lectura de arriba a abajo** — se puede automatizar en un
minuto con un script que extraiga selectores y busque repetidos (lo hice ad
hoc, no lo dejé en el repo).

**También arreglé — CSS huérfano de la versión anterior del reproductor:**
`.player-select` (el `<select>` de audio/subtítulos) y `.player-barra-tiempo`
(el `<input type="range">` de "Mi enlace") no correspondían a ningún elemento
del DOM actual: `native-player.tsx` los sustituyó por `.atv-riel` y
`.atv-menu-item` y nadie borró el CSS viejo. Confirmado por grep en todo
`src/`, incluyendo plantillas dinámicas (`` `is-${x}` ``) para no repetir el
error de marcar como muerto algo que se arma en runtime — varias clases que
parecían huérfanas (`is-vivo`, `is-pausa`, `is-emitiendo`…) eran justo eso:
falsos positivos por construcción dinámica del className.

**Lo que encontré y NO toqué — ya lo estaba arreglando otra sesión en
paralelo:** `src/lib/catalog/providers.ts` tenía `proxyDeVimeus` como función
sin usar (`no-unused-vars` en error, así que esto rompía `npm run verify` en
`main`). Mientras investigaba vi en tiempo real que otra sesión lo estaba
editando en el mismo directorio de trabajo compartido — no en un worktree
propio — y lo dejó resuelto en el commit `49747b0` ("Vimeus otra vez
funcional: el proxy anti-anuncios queda desconectado"), ya fusionado. No
dupliqué el arreglo. **Lección operativa:** antes de tocar un archivo,
`git diff` contra `origin/main` para confirmar que el hallazgo sigue vivo
ahí — el propio directorio de trabajo compartido puede estar más adelantado
que lo que acabas de leer.

**Proxy de Vimeus (`/api/proxy/vimeus`, `/api/proxy/vimeos-asset`) — revisado
por SSRF/open redirect, sin cambios porque ya estaba bien:** el primero tiene
el destino totalmente anclado (`VIMEUS_BASE` fijo, el único parámetro de
usuario es un `tmdbId` numérico validado con `Number.isFinite`); el segundo
valida el parámetro `u` contra una allowlist de dominio con comparación de
sufijo correcta (`host === permitido || host.endsWith('.' + permitido)`, no
un `.includes()` ingenuo). Ninguno reenvía cookies ni cabeceras de
autorización. El bloqueo de `window.open` vía `Object.defineProperty` con
`writable: false` que dejó otra sesión sigue en su sitio, no lo toqué.

**`native-player.tsx` — sin código muerto, pero dos cosas para anotar:**

1. Los 22 `data-nav` cubren todos los controles interactivos del reproductor
   (contados uno por uno contra la lista de botones/inputs del JSX).
2. **`detectKind` es la TERCERA implementación de "qué tipo de stream es esta
   URL"**, sumándose a `claseDeEmision` (`lib/reproduccion/motor.ts`) y
   `claseDeUrl` (`lib/fuente-propia/url.ts`), que ya estaban en el backlog de
   unificación (punto 3 de "Lo siguiente", ahí desde antes de esta sesión). No
   lo toqué — unificar tres sitios es un refactor, no una limpieza, y se sale
   de "cambios que no alteran comportamiento" tal como está la firma de cada
   una ahora mismo (parámetros y tipos de retorno distintos). Lo subo de
   prioridad en la lista de abajo.
3. **Posible doble manejo de flechas, sin confirmar con Playwright:**
   `native-player.tsx` no importa `useSpatialNav`; su propio `onKeyDown`
   (`alTecla`) intercepta ArrowUp/Down/Left/Right con `preventDefault()` para
   buscar/subir volumen. Pero `preventDefault()` no detiene la propagación, y
   `NavegacionCatalogo` (que envuelve la ficha en el catálogo/modo cine) monta
   `useSpatialNav` con `enabled: true` siempre, sin desactivarlo mientras el
   reproductor tiene el foco — a diferencia de `fullscreen-player.tsx`, que sí
   lo desactiva explícitamente para la tele en vivo (ver el comentario en
   `use-spatial-nav.ts`). Si el análisis es correcto, cada flecha dentro del
   reproductor de "Mi enlace"/ficha también movería el foco espacial por el
   `data-nav` más cercano del `root` entero de `NavegacionCatalogo` — no solo
   por el reproductor. **No lo toqué**: arreglarlo cambia comportamiento real
   (no solo quita código muerto) y cruza `navegacion-catalogo.tsx`, que el
   dueño de reproducción/catálogo pidió no tocar por el modo cine reciente.
   Lo dejo para que lo confirme quien sí puede tocar ese archivo — se
   verifica en dos minutos con un mando o las flechas del teclado dentro de
   una ficha con enlace propio.

**Dependencias:** `npm audit` en cero (29 prod, 476 dev, 141 optional). Ni el
proxy ni el rediseño del reproductor añadieron dependencias nuevas —
`git diff 88b0eef..origin/main -- package.json package-lock.json` no devuelve
nada.

**Sin Playwright en esta sesión.** No hay `playwright.config.*` ni
referencias en `package.json`/`docs`: la auditoría visual de sesiones
anteriores se hizo con un navegador interactivo dentro de la sesión, no con
una suite committeada, y esta sesión no tuvo esa herramienta disponible. La
verificación del cambio de CSS se apoyó solo en matemática de especificidad +
`npm run verify`. Si se repite: pedir explícitamente la herramienta de
navegador antes de tocar CSS de layout.

**Encontré, no toqué, y dejé anotado:** en `.worktrees/agente-calidad` había
una extracción a medias de `epg.ts` sin terminar (`src/lib/epg/canales.ts`
con `indexarCanales`, `getAttr`, `decodeXmlEntities`ya movidos, fechada dos
días antes de esta sesión). La dejé en `git stash` (mensaje: "wip: extracción
epg/canales.ts sin terminar") en vez de perderla o terminarla a mitad de una
sesión con otro objetivo. Quien retome el hotspot de `epg.ts` la tiene ahí.

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando.

---

## Lo siguiente

Por orden de retorno:

1. `stream-player.tsx` (8,64) y `fullscreen-player.tsx` (8,29): los dos marcan
   *Large Method*. Sacar controles y Cast a sus piezas.
2. Extraer los hooks de `dashboard.tsx` — 27 commits, el archivo que más se toca.
3. Unificar `claseDeEmision`, `claseDeUrl` **y ahora también `detectKind`**
   (`native-player.tsx`): las tres clasifican URLs de vídeo por extensión con
   reglas parecidas, escritas por separado. Cada reescritura del reproductor
   añade una implementación más en vez de reusar una de las dos que ya
   existían.
4. `m3u.ts` (8,75): separar descargar de interpretar.
5. Retomar la extracción de `epg.ts` que quedó en `git stash` en
   `.worktrees/agente-calidad` (ver diario de 2026-09-02) o descartarla si ya
   no aplica.
6. Activar la integración de PRs de CodeScene, para que esto sea continuo.

⚠️ Hay un token de TMDB de solo lectura en el historial de Git. No sale al
navegador, pero si el repositorio deja de ser privado hay que rotarlo.
