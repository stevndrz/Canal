# Memoria de `catalogo`

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

Mi definición está en `.claude/agents/catalogo.md`; ahí van las reglas. Aquí va
lo que ha pasado.

---

## Mi zona

```
src/app/peliculas/ · src/app/api/buscar/
src/components/catalog/ · views/fuente-view.tsx · native-player.tsx
src/lib/catalog/ · lib/fuente-propia/
src/hooks/use-buscar-titulos.ts · use-fuentes.ts
```

**No toco:** nada de `livetv/`, `m3u.ts`, `epg.ts`, ni el CSS.

---

## Decisiones tomadas

- **La credencial de TMDB no sale al navegador.** Por eso la búsqueda pasa por
  `/api/buscar`.
- **Nada se almacena.** Cada página se pide al navegar y se descarta al salir.
- **TMDB rechaza páginas por encima de 500** aunque diga que hay miles.
- **El cambio de servidor lo hace la persona.** El iframe es de otro dominio:
  no se puede saber si cargó ni en qué idioma está.
- **`catalog.json` vacío**, todo de TMDB. El mecanismo manual sigue por si acaso.
- **Solo se promete lo que se sabe:** «hablada en español» solo si TMDB dice que
  se rodó así; para el resto, subtítulos.

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-10-08 — Vidzee pasa a segundo, detrás de Vimeus

El dueño confirmó que el que de verdad le reproduce en el teléfono es Vidzee.
Orden nuevo: Vimeus, Vidzee, Multiembed, Vidrock. Así Vidzee es el primero en
series y en las películas que Vimeus no tiene, en todos los aparatos (en la
tele ya lo era, porque Multiembed va al final allí).

Corrección a la entrada de abajo: el proxy de Vimeus está **desconectado**
(ver el comentario en `providers.ts`), así que sus anuncios no se bloquean en
la web. Probar si aguanta `sandbox` no fue concluyente aquí: con y sin él,
JWPlayer da el error 102630 por el códec del Chromium del contenedor.

### 2026-10-08 — Pop-ups: sandbox solo donde lo aguantan, y la app Android

- `sandbox` sin `allow-popups` es lo único que impide de verdad que un iframe
  ajeno abra pestañas. Puesto a todos rompía la reproducción, así que ahora va
  por proveedor (`toleraSandbox`). Probado con Playwright (Matrix, dos clics):
  **Vidzee** reproduce igual con sandbox, pantalla completa incluida, y
  `window.open` devuelve `null`; **Vidrock** dice «Sandbox Not Allowed» y sin
  él abrió una pestaña al primer clic; **Multiembed** no se puede probar desde
  un servidor (reto de Cloudflare).
- App Android: una WebView sin ventanas múltiples carga el `window.open` EN
  LA MISMA VISTA, tapando la película. Ahora `onCreateWindow` lo descarta y
  `shouldOverrideUrlLoading` no deja que la ventana principal salga del
  dominio de la app. Efecto aceptado: en la tele, los enlaces externos (IMDb,
  tráiler en YouTube) no hacen nada.
- No se intentó esquivar la detección de sandbox de Vidrock: sería saltarse
  una protección del proveedor.

### 2026-10-08 — Servidores: Vimeus primero, Multiembed de recaída

Pedido del dueño: «solo el cuarto o quinto funciona». Probé cada servidor con
Playwright desde el contenedor (película 155):

| Servidor | Resultado | Decisión |
|---|---|---|
| Vimeus | carga «S1 vimeos.net»; aquí no reproduce por el códec del Chromium de prueba | 1.º en películas |
| Multiembed | puerta de Cloudflare; al dueño le funciona | 2.º (recaída); en tele, al final |
| vidsrc.pm | «Not found» en todo | retirado |
| Videasy | 403 «Access denied» | retirado |
| VidLink | el servidor de vídeo responde 428 | retirado |
| VidZee | descarga HLS y segmentos, duración real; películas y series | nuevo |
| VidRock | igual que VidZee; subtítulos solo en inglés | nuevo |

Sorpresas: ninguno responde distinto si no tiene el título (todos 200), así
que solo Vimeus filtra por estado. La etiqueta «Subtítulos en español» se
quitó: el único que los traía era VidSrc. Este Chromium no trae H.264: la
prueba válida es «pide un .m3u8 / el `<video>` tiene duración», no «se ve».

### 2026-09-02 — Modo cine: el reproductor ocupa la pantalla, pero solo en TV

Pedido explícito: en el cascarón de un televisor, seleccionar un título tiene
que abrir el reproductor a pantalla completa —como un canal en vivo—, no
compartir sitio con la carátula. En un navegador, la ficha se queda
exactamente como estaba.

- **Un estado, no una ruta.** `TitleDetail` guarda `modoCine` (arranca en
  `enTelevisor`, que decide el servidor con el User-Agent). `FichaReproductor`
  sigue montado en el MISMO sitio del árbol al entrar y salir del modo cine
  —solo cambia la clase de su contenedor, `.ficha-reproductor-slot` ↔
  `.ficha-cine`—, así que el vídeo no se reinicia ni el iframe del proveedor
  se recarga.
- **`.ficha-cuerpo` se partió en dos** (`ficha-reproductor-slot` +
  `ficha-cuerpo`): antes envolvía reproductor+sinopsis+episodios con un solo
  ancho de 1440px; separarlos es lo que le permite al reproductor salirse a
  pantalla completa sin llevarse el resto. El padding se repartió tal cual
  estaba (arriba para uno, abajo para el otro) para no cambiar nada en modo
  normal.
- **`NavegacionCatalogo` ahora acepta un `onBack` propio.** Por defecto sigue
  yendo a Inicio (como hacía siempre en el catálogo); en modo cine, Atrás
  cierra el reproductor grande y enseña la ficha de siempre — la segunda
  pulsación de Atrás, ya en la ficha normal, vuelve a ser la de siempre.
- **Elegir otro episodio en TV vuelve a llenar la pantalla** con él: es la
  misma acción que abrir el título la primera vez, no una excepción.
- **Sin probar con un título real**: este sandbox no tiene `TMDB_API_KEY`
  configurada, así que el catálogo sale vacío y toda ficha da 404. El código
  pasa `typecheck`/`lint`/tests y sigue el mismo patrón ya verificado en vivo
  para canales, pero **queda pendiente mirarlo en el preview real** (que sí
  tiene la clave) antes de darlo por bueno del todo.

### 2026-09-02 — Pasada de mejoras: error.tsx, Mi lista, Seguir viendo, tráiler, IMDB, recomendados

Seis cambios en cuatro PRs sobre el mismo diagnóstico: había datos que TMDB ya
daba (`imdbId`, `videos`, `recommendations`) o que la app ya calculaba
(`useProgreso`) y que `/peliculas` y la ficha no enseñaban.

- **`error.tsx` en la ficha.** Antes solo había `<Suspense>`; si `fetchTitle`
  alguna vez lanzara en vez de devolver `null`, la ruta entera caía al de la
  raíz, que no sabe volver al catálogo.
- **Esqueleto en la búsqueda.** Reusa `.esqueleto-cartel` + `.grid-results`,
  que ya existían — cero CSS nuevo.
- **IMDB, tráiler y recomendados.** `fetchTitle` suma `videos` a
  `append_to_response` (gratis, TMDB ya lo cuenta como una petición) para el
  tráiler y usa el `imdbId` que ya traía y se quedaba en el servidor. El héroe
  de `/peliculas` sale de `fetchCatalogRows()`, que NO trae vídeos —costaría
  una petición por título de cada fila—, así que para su tráiler hay una
  petición aparte (`fetchTrailer`) solo para el título ya elegido; se
  aprovecha el cacheo de un día de `tmdbConClave`. `fetchRecommendations` +
  `fetchSimilar` (discover.ts) alimentan «También te puede interesar» al
  final de la ficha con el mismo mapeo a tarjeta que las filas curadas.
- **Seguir viendo y Mi lista.** Las dos cruzan lo que YA llegó en las filas
  curadas con lo que hay en `localStorage` (`seguirViendo`/`enMiLista` en
  `media-item.ts`) — nunca piden nada nuevo a TMDB por cada progreso o marca
  guardada. Eso es una limitación real: un título dejado a medias que no está
  entre las filas curadas de esa visita (algo encontrado por búsqueda, por
  ejemplo) no aparece en «Seguir viendo». Se aceptó a propósito: inventar una
  petición nueva por cada entrada de progreso guardada rompía la regla de
  «nada se cachea, cada página se pide fresca» en la dirección contraria —
  ahora sería pedir de más, no de menos. `usePersistedSet` se generalizó a
  `<T extends string | number>` para que «Mi lista» (`use-watchlist.ts`)
  pueda guardar `"movie-tmdb-550"` sin duplicar el hook de favoritos.

**Aprendido:** anidar un `<div className="ficha-cuerpo">` alrededor de un
`MediaRail` nuevo dobla el `padding-left` — `.ficha-cuerpo` YA pone
`var(--margen)` como padding, y `.rail` pone el suyo. El carril de
recomendados va directo en `.app-shell`, como en Inicio.

**Para el que siga:** el botón de tráiler del héroe de `/peliculas` cuesta una
petición HTTP extra a TMDB (cacheada un día). Si algún día importa recortarla,
la alternativa es no mostrarlo ahí y dejarlo solo en la ficha, donde ya es
gratis.

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando.

---

## Lo siguiente

**Mi encargo abierto: una API de películas con audio latino.**

Descartado y por qué — no reproponer sin argumento nuevo:

- *Scraping en caliente* (Cinecalidad): se construyó y se retiró. Los enlaces
  caducan en horas y hace falta un Chromium de verdad, que no cabe en una
  función sin servidor. Frágil por diseño.
- *Magnet / BitTorrent en el navegador*: solo se abre WebRTC, y los clientes
  normales usan TCP y uTP. Lo único que funciona es el web seed (`ws=`), ya
  implementado en `lib/fuente-propia/magnet.ts`.

De cada candidata hay que responder: ¿clave?, ¿límite de peticiones?, ¿caduca el
enlace?, ¿el audio latino se pide o se supone?, ¿qué pasa el día que se caiga?

**Backlog anotado, sin construir:**

- Insignias de «disponible en» (TMDB `watch/providers`).
- Página de reparto: «más títulos con este actor».
- Auto-avance al siguiente episodio — solo viable para Mi enlace (el
  `<video>` es nuestro); un iframe de otro dominio no avisa cuándo termina.
