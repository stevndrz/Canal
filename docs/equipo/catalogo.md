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

### 2026-11-09 — Seguir viendo juntos, historial y sala recordada

- `lib/ver-juntos/historial.ts` (puro, 6 pruebas): cada aparato de la sala
  apunta en `localStorage` (`canalcasa:juntos-historial`, 30 entradas) la
  película, el segundo, la duración, con quién y cuándo. Cada 5 s, al pausar y
  al saltar; nunca el segundo 0 de antes de empezar.
- `irA(tiempo)` en `use-ver-juntos.ts`: lleva a toda la sala a un segundo, en
  pausa, lo pulse quien lo pulse. **Sin mensajes nuevos**: es un `estado`
  normal; «Retomar» = `irA` + el `empezar` de siempre. Aparatos con la versión
  anterior lo entienden igual.
- «Retomar en 47:10» sustituye a «Empezar» si la sala dejó la película a
  medias (> 60 s y < 94 %) y el vídeo no está ya ahí; «Desde el principio» al
  lado.
- «Volver a la sala 4821» (`canalcasa:juntos-ultima-sala`). Al volver, la
  película de este aparato solo se pone si la sala estaba vacía: si ya hay
  alguien, manda la suya.
- «Vistas juntos» reutiliza `.fuente-lista`; lo único nuevo de CSS es el ancho
  de `.cine-vistas`. Las que ya no están en la nube salen apagadas.
- Probado con Playwright: dos aparatos ven hasta 1:10, cierran, vuelven a la
  sala y el que NO dirige pulsa Retomar: los dos acaban a menos de 1,5 s.
- Sin probar: aparatos reales; qué pasa si cada aparato recuerda una sala
  distinta (cada uno vuelve a la suya: se ve en la presencia que están solos).
- Idea sin hacer: con sala recordada, que el botón principal fuera «Volver a
  la sala» y «Crear sala» pasara a secundario.

### 2026-11-09 — Sincronizar sola: tarea de Windows y modo `--automatico`

Tarea programada (cada 10 min, `wscript` con ventana 0 para que no salte una
consola) y no un vigilante de carpeta: la mantiene Windows, y «¿acabó la
descarga?» ya lo sabía la biblioteca (2 min sin tocarse).

- `sincronizar.mjs --automatico`: sin preguntas. `soloLoQueAnade` parte el
  plan: subir, adoptar, renombrar y subtítulos NUEVOS se hacen; huérfanas,
  basura, reemplazos, subtítulos borrados y «no cabe en 10 GB» quedan en
  `pendientes` y **no se llama a `purge`/`deletefile`** (hay una prueba que
  mira las órdenes que recibe rclone).
- `Estado de la sincronizacion.txt` en la carpeta: qué subió, qué espera a la
  persona, o por qué falló. El dueño no quiso aviso al teléfono.
- `tarea.mjs activar|quitar|estado` + `sincronizar-sola.cmd`. El `.vbs` se
  escribe en UTF-16 con BOM (rutas con acentos).
- Pruebas: `programa.test.mjs` lanza el programa entero con ffmpeg real y
  `pruebas/rclone-falso.mjs` (59 pruebas en `scripts/`).
- Sin probar: todo lo de Windows (`schtasks`, `wscript`, que de verdad no
  salga ventana, la tarea con la sesión bloqueada). Con rclone cifrado la
  tarea no puede pedir la contraseña: falla diciéndolo; queda
  `RCLONE_PASSWORD_COMMAND` como salida, sin receta probada.

### 2026-11-09 — ¿Ver juntos con Vimeus? No hay mando: «sincronía suave»

Leído el código que sirve Vimeus (sin ejecutarlo; el script de vimeos.net va
empaquetado y se desempaquetó como texto). Detalle en `docs/VIMEUS-JUNTOS.md`.

- Dos iframes: `vimeus.net/e/…` (envoltorio React) → `vimeos.net/embed-…`
  (JWPlayer). **Ninguno escucha `message`.** vimeos.net solo *manda* su
  configuración al padre si este es `tv.la.movie` (lista blanca).
- `/cf/*` no es un mando: se salta el envoltorio y exige un token `cf` de
  sesión por aparato y título («invalid_cf_format»). No se intentó forjarlo.
- `logo_url`/`primary_color` no existen en su código; sí `theme`, `overlay`,
  `playUI`, `autoplay`…
- Propuesta: reloj compartido de la sala + «Listo» después de los anuncios +
  «Pausa para todos» / «Voy por…». Sin construir: espera al dueño.

### 2026-11-09 — Vimeus con cuenta propia: series en latino y sin «Not Found»

- `vimeus.com` murió (200 con redirección a una página de aparcamiento): la
  comprobación por estado lo daba por bueno y el marco enseñaba «Not Found».
  Ahora `vimeus.net` con la view key de la casa (`NEXT_PUBLIC_VIMEUS_VIEW_KEY`,
  con valor por defecto).
- Medido: 404 exacto por episodio (`/e/serie?…&se=9` → 404) en ~0,25 s, y
  `/e/serie` y `/e/anime` se excluyen entre sí. Se ofrecen `vimeus` y
  `vimeus-anime` y la comprobación deja el bueno. Vimeus pasa a primero
  también en series y anime, con la marca «Latino» en el botón.
- El respaldo instantáneo de la ficha (al cambiar de episodio) ya no es nunca
  un servidor por comprobar: era el otro origen del «Not Found».
- API (`VIMEUS_API_KEY`, `lib/catalog/vimeus.ts`, `use cache` en horas): riel
  «Recién llegadas en latino» en Inicio/Películas/Series/Anime y marca
  «Latino» en los episodios que tiene. La respuesta real no es la de su
  documentación (`data.result`/`data.pages`); se leen las dos.
- Ojo en el contenedor: el `fetch` de Node no usa el proxy; para probar con la
  clave inyectada, `NODE_USE_ENV_PROXY=1 npm run dev`.
- Sin probar: la marca «Latino» en la lista de episodios de una ficha (aquí no
  hay clave de TMDB para abrir fichas; la lógica tiene pruebas).

### 2026-11-09 — Sincronizar «Nuestras películas» desde una carpeta (Node)

El dueño pedía algo más fácil y fiable que renombrar a `pelicula.mkv`, subir,
añadir subtítulos aparte y borrar con otro script. Ahora `Descargas\Peliculas`
es la biblioteca y `Sincronizar peliculas.cmd` deja la nube igual
(`scripts/peliculas/sincronizar/`). En Node y no en PowerShell porque así se
puede probar entero aquí (46 pruebas, una de punta a punta con ffmpeg real y
una nube que es una carpeta) y se acaban los líos de PowerShell 5.1.

- Plan puro (`plan.mjs`): huella del vídeo (tamaño + 4 MB del principio y del
  final) para reconocer la misma película renombrada; por id las del script
  viejo («adoptar»); subtítulos por su huella; huérfanas = se pregunta.
- Subida a carpeta nueva `<id>-<huella6>` + `rclone check` antes de tocar el
  catálogo; copia `catalogo.anterior.json`; nunca escribe si no pudo leer.
- Los subtítulos del script viejo (sin huella) se emparejan por idioma para no
  duplicarlos.
- Probado además el programa entero con un `rclone` falso (los argumentos
  exactos) contra un catálogo en el formato que escribía PowerShell.
- Sin probar en Windows: rutas con `\`, la consola de cmd, winget.

### 2026-11-07 — Ver juntos: sala con código de 4 cifras (sin PIN de Vercel)

El dueño pidió algo más sencillo que la vinculación con `SALA_PIN` y llaves
firmadas: un código de cuatro cifras por sala, comprobable a ojo, y que cada
uno elija su alias. Fuera `/api/sala/vincular`, `vinculo.ts`,
`intentos-pin.ts`, `SALA_PIN` y `SALA_SECRETO`. `/api/pusher/auth` firma
`presence-juntos-\d{4}` con el id y el alias que manda el aparato (los
`params` de `channelAuthorization`). La película se recuerda por sala en
`sessionStorage`. Se conservan presencia, quién dirige, «la última manda» y
la cuenta atrás.

### 2026-11-07 — Mi enlace: «sala de cine para dos»

- La vista es la portada de la película de la sala (fondo de TMDB por
  `/api/buscar`, recordado una semana en `localStorage`), con presencia,
  un botón principal que dice lo siguiente (Vincular → Entrar → Empezar →
  Volver a la película) y «Cambiar película» que lleva al estante.
- Píldoras: duración (catálogo), audios (leídos del `master.m3u8`,
  `audiosDelMaster`) y subtítulos.
- «Usar un enlace» y «Vincular» van en hojas (`Hoja`), fuera de la vista.
- El escenario inmersivo se monta en cuanto hay película en la sala, invisible:
  así «Empezar» desbloquea el `<video>` dentro del toque (Safari) y carga
  durante la cuenta atrás. Atrás vuelve a la portada sin pausar al otro.
- Fuera de la sala, la portada enseña la última película que tuvo la sala;
  «Ver aquí solo» la pone sin sala.

### 2026-11-07 — Ver juntos: sala única con aparatos vinculados (sustituida, ver arriba)

Fuera los códigos de seis letras. Cada aparato se vincula una vez con
`SALA_PIN` (4 cifras) y un nombre; `/api/sala/vincular` devuelve una llave
HMAC (`SALA_SECRETO`, con el PIN dentro de la clave) que se guarda en
`localStorage`. `/api/pusher/auth` solo firma el canal `presence-sala-<hmac>`
y solo con llave; el nombre de la presencia sale de la llave firmada.

Decisiones:
- **Sin película elegida**: la sala dice «Elijan una película» y no hay
  «Empezar».
- **No hay anfitrión fijo.** Dirige quien eligió la película (su pulso de
  5 s corrige); si no está, quien llegó antes (`quienDirige`). Play, pausa y
  saltos de cualquiera pasan en todos.
- **La última elegida manda**: versión entera (no hora: las teles van con el
  reloj desviado), desempate por id (`masNueva`). Se recuerda por aparato; al
  encontrarse gana la más nueva.
- Tope de PIN: 5 fallos/IP y 40 en total por 15 min, por instancia.
- Teclado del PIN en captura: si no, `useMarcado` tomaba las cifras por un
  número de canal.

Probado con Playwright (PC + tele por teclado) y un Pusher simulado que
**comprueba la firma** con el secreto. Sin probar con Pusher real: la firma
de presencia sigue `socket:canal:channel_data` (el ejemplo hexadecimal de la
documentación de Pusher no sale de su propia cadena; `openssl` coincide con
lo nuestro).

### 2026-10-08 — Vidzee pasa a segundo, detrás de Vimeus

El dueño confirmó que el que de verdad le reproduce en el teléfono es Vidzee.
Orden nuevo: Vimeus, Vidzee, Multiembed, Vidrock. Así Vidzee es el primero en
series y en las películas que Vimeus no tiene, en todos los aparatos (en la
tele ya lo era, porque Multiembed va al final allí).

Corrección a la entrada de abajo: el proxy de Vimeus está **desconectado**
(ver el comentario en `providers.ts`), así que sus anuncios no se bloquean en
la web. Probar si aguanta `sandbox` no fue concluyente aquí: con y sin él,
JWPlayer da el error 102630 por el códec del Chromium del contenedor.
### 2026-10-08 — Películas, Series y Anime: tres secciones en vez de «Cine y series»

- Rutas `/peliculas` (solo películas), `/series` y `/anime`. Las tres son el
  mismo componente (`seccion-catalogo.tsx`) con otra sección; el modelo vive
  en `lib/catalog/secciones.ts`. Las fichas siguen en
  `/peliculas/[mediaType]/[id]`: así no se rompen «Seguir viendo», «Mi
  lista» ni enlaces guardados.
- Cada sección trae sus filas (`FILAS_PELICULAS`, `FILAS_SERIES`,
  `FILAS_ANIME` en `discover.ts`). Inicio sigue con las de siempre, mezcladas.
- **Anime = Animación (16) + idioma original japonés.** TMDB no tiene género
  «Anime». Los pisos de votos son más bajos que en Series porque el anime
  tiene menos votos en TMDB. En Anime el género elegido se SUMA a Animación
  (`with_genres=16,35`): «Comedia» es comedia de anime.
- Las píldoras Todo/Películas/Series solo salen en Anime; en las otras dos el
  tipo lo da la sección y no va en la URL.
- `/peliculas?tipo=tv` (enlaces viejos) redirige a `/series` con el resto de
  filtros.
- La barra marca la sección también dentro de una ficha: una serie enciende
  Series aunque la ruta sea `/peliculas/tv/…` (`seccionDeRuta`).
- Teléfono: Inicio, Canales, Películas, Series, Anime + «Más». Buscar pasó a
  «Más»; cada sección tiene su buscador. Medido a 393 px: 62 px por casilla,
  sin etiquetas cortadas.
- Sin `TMDB_API_KEY` en el contenedor: las filas de anime se verificaron en la
  vista previa de Vercel, no aquí.

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
