# 📺 CanalCasa

Plataforma de streaming de TV para hogares guatemaltecos. Organiza canales nacionales, películas/series y más desde una única lista M3U (Gist), sin base de datos ni autenticación: la página queda 100% libre de infraestructura.

## 🚀 Inicio rápido

### Requisitos previos

- **Node.js** 18.18+ (recomendado 20+)
- Una lista M3U pública (por defecto se usa un [Gist](https://gist.github.com) con los canales de Guatemala)

### Instalación (desarrollo local)

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Por defecto la app carga la lista M3U desde el Gist configurado en `src/lib/m3u.ts`. Para usar otra lista sin tocar el código, define la variable de entorno `M3U_URL` (ver abajo).

---

## ☁️ Despliegue en Vercel

1. Sube el proyecto a GitHub e impórtalo en Vercel (detecta Next.js automáticamente).
2. (Opcional) En **Settings → Environment Variables**, define `M3U_URL` si quieres apuntar a una lista distinta a la que trae el código por defecto.
3. Despliega. No hace falta configurar ninguna base de datos: la lista de canales se descarga en cada request (`revalidate: 30`) directamente desde la URL del M3U.

### Actualizar la lista de canales

No hace falta redesplegar ni tocar el código:

1. Edita el archivo M3U que apunta `M3U_URL` (o el Gist por defecto).
2. Agrega/quita bloques `#EXTINF` con su URL de stream.
3. Guarda los cambios. La página los recoge automáticamente (caché de 30s).

La importación elimina duplicados por URL de stream y organiza los canales priorizando Guatemala, deportes, noticias, películas/series, infantil, música, religión, entretenimiento e idioma.

---

## ⚙️ Variables de entorno

Ninguna es obligatoria: la app arranca recién clonada, sin configurar nada.

| Variable             | Para qué                                                        |
|----------------------|-----------------------------------------------------------------|
| `M3U_URL`            | Otra lista de canales en vez del Gist que trae el código        |
| `EPG_URL`            | Guía de programación en XMLTV. Sin ella las filas no dicen qué dan |
| `TMDB_API_KEY`       | Credencial propia de TMDB. Hay una de reserva en el código       |
| `STREMIO_MANIFESTS`  | Addons que sirven enlaces directos — **la vía sin anuncios**      |
| `NEXT_PUBLIC_EMBED_PROVIDER_MOVIE` / `_TV` | Un servidor de embeds propio, delante de la lista |
| `NEXT_PUBLIC_CANALES_CASA` | Los canales que se ven de cajón, separados por comas. Salen los primeros en Canales y tienen su riel en Inicio, **en todos los aparatos** |
| `CANALES_EN_HTML=todos` | Marcha atrás: manda los 7.822 canales en el HTML, como antes |

Las que llevan credencial viven en [`src/lib/config.server.ts`](src/lib/config.server.ts),
con `import "server-only"`, para que no puedan cruzar al navegador ni por
accidente; las públicas, en [`src/lib/config.ts`](src/lib/config.ts).

---

## 🚫 Películas sin anuncios (`STREMIO_MANIFESTS`)

Los servidores «Servidor 1, 2, 3…» son iFrames de terceros: su reproductor, sus
anuncios, y desde fuera **no se puede tocar nada de lo que pasa dentro**. Es el
precio de que sean gratis.

La única salida real no es bloquear sus anuncios, es **no usar su reproductor**.
Eso es lo que hace `STREMIO_MANIFESTS`: un addon de Stremio es simplemente una
URL que, dada una película por su id de IMDB, responde con una lista de enlaces
de vídeo en JSON. Cuando alguno de esos enlaces es un `.mp4`/`.m3u8` directo,
CanalCasa lo reproduce **en su propio `<video>` con hls.js** y el iFrame ajeno
deja de existir: sin anuncios, sin sandbox y sin nada de nadie. Aparecen en la
ficha como botones «Directo · …» junto a los demás.

```bash
STREMIO_MANIFESTS="https://addon-uno.example,https://addon-dos.example"
```

La URL es la **base** del addon, la que lleva `/manifest.json` detrás, incluido
su trozo de configuración si lo tiene. La app pide `{base}/stream/movie/tt….json`.

**El detalle que decide si esto te sirve:** [`stremio.ts`](src/lib/resolvers/stremio.ts)
descarta todo lo que no sea http(s) directo, y **la mayoría de addons devuelven
torrents**, que un navegador no puede reproducir. Para que un torrent se
convierta en enlace directo hace falta un servicio de *debrid* configurado
dentro de la URL del addon. Sin eso la lista llega vacía y la ficha se queda
igual que antes, sin avisar.

Por eso existe el comprobador, que aplica **los mismos filtros que la app**:

```bash
npm run addon -- https://tu-addon.example/con-su-configuracion
```

Dice cuántos enlaces llegan, cuántos sobreviven al filtro y —lo importante— si
responden de verdad. Un enlace firmado contra la IP de quien lo pidió da 403
desde el servidor, y ese fallo de otro modo solo se descubre dándole al play.

> Dos avisos que ahorran tiempo. **Uno:** la petición sale del *servidor*
> (`/api/stream`), no del navegador; los addons que bloquean IPs de centro de
> datos fallan igual en Vercel. **Dos:** usa únicamente fuentes autorizadas.

---

## 🛠️ Scripts disponibles

| Comando            | Descripción                                        |
|--------------------|----------------------------------------------------|
| `npm run dev`      | Inicia el servidor de desarrollo (Turbo)           |
| `npm run build`    | Compila la aplicación para producción              |
| `npm run start`    | Inicia el servidor de producción                   |
| `npm run lint`     | Ejecuta ESLint                                     |
| `npm run typecheck`| Verifica tipos con TypeScript                      |
| `npm run test`     | Pruebas de la lógica pura (vitest)                 |
| `npm run addon`    | Comprueba si un addon de Stremio sirve enlaces     |
| `npm run verify`   | **Los cuatro de golpe.** Lo mismo que corre en CI  |

---

## 🏗️ Arquitectura del proyecto

```
Canal/
├── src/
│   ├── app/
│   │   ├── globals.css         # Tokens, restablecimientos y pantallas propias
│   │   ├── shell.css           # El armazón: barra, rieles, tarjetas, canales
│   │   ├── layout.tsx          # Layout raíz con metadata
│   │   ├── page.tsx            # Canales en vivo (SSR, dynamic)
│   │   ├── peliculas/          # Catálogo TMDB y la ficha de cada título
│   │   └── api/                # `canales`, `buscar` y `stream`: lo que no va en el HTML
│   ├── components/
│   │   ├── stream-player.tsx   # Reproductor de canales (hls.js / mpegts.js)
│   │   ├── native-player.tsx   # Reproductor de enlaces directos, con controles
│   │   ├── catalog/            # Ficha, servidores, filtros, buscador del catálogo
│   │   ├── livetv/             # Pestaña de canales: lista, categorías, detalle
│   │   ├── media/              # Tarjetas y rieles, compartidos por todo
│   │   ├── player/             # Barra de controles y guía, compartidas
│   │   ├── shell/              # Barra superior
│   │   └── views/              # Una por destino: inicio, buscar, favoritos, ajustes…
│   ├── hooks/                  # Navegación con mando, pantalla completa, cast…
│   └── lib/
│       ├── m3u.ts              # Descarga y normaliza la lista M3U (categorías, dedupe)
│       ├── lista-canales.ts    # La lista lista para el cable, memorizada por descarga
│       ├── canales-empaquetados.ts # Cómo viajan los canales, y el recorte de la portada
│       ├── types.ts            # Tipo `Channel` compartido
│       ├── catalog/            # TMDB, proveedores de reproducción, descubrimiento
│       ├── reproduccion/       # Qué motor reproduce cada enlace, cast, bucles
│       ├── resolvers/          # Fuentes directas (addons de Stremio)
│       └── fuente-propia/      # «Mi enlace»: validar URLs y magnets
├── scripts/                    # Utilidades sueltas (lista M3U, probar addons)
├── next.config.ts
├── package.json
└── tsconfig.json
```

La lógica que se puede razonar sin montar un componente vive en `src/lib` y
tiene pruebas; los componentes se quedan con el estado y el DOM. Las trampas de
la cascada CSS están en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

No hay `db/` ni `DATABASE_URL`: todo el estado vive en memoria del servidor (por
request) y en `localStorage` del navegador. Lo que cada aparato recuerda:

| Clave | Qué guarda |
|---|---|
| `canalcasa:ajustes` | Los Ajustes de reproducción |
| `canalcasa:ultimo` | El último canal visto, con su nombre para poder verificarlo |
| `canalcasa:caidos` | Qué canales han dejado de responder — ver [`canales-caidos.ts`](src/lib/canales-caidos.ts) |
| `canalcasa:favorites` · `canalcasa:recents` · `canalcasa:fuentes` | Favoritos, historial y «Mi enlace» |

Lo compartido entre aparatos NO va por ahí: va por configuración
(`NEXT_PUBLIC_CANALES_CASA`), que se cambia en un sitio y aparece en todos.

Sí hay `api/`:

- `/api/buscar` y `/api/stream` existen para no sacar la credencial de TMDB al
  navegador.
- `/api/canales` sirve la lista completa. **El HTML de la portada solo lleva los
  ~200 canales que se pintan al abrir**; el resto llega por aquí, ya con la
  primera pantalla dibujada y desde una respuesta que sí se cachea en el borde.
  Con eso la portada pasó de 376 KB a 58 KB comprimidos. El porqué y el cómo
  están en [`src/lib/canales-empaquetados.ts`](src/lib/canales-empaquetados.ts);
  lo importante es que **el `id` de cada canal no cambia**, porque los favoritos
  guardados son ids.

---

## 📡 Reproducción de video

El reproductor (`src/components/stream-player.tsx`) reproduce las URLs del M3U **directamente**, sin proxy intermedio:

- **HLS (`.m3u8` o sin extensión, el caso más común en listas IPTV)** → [`hls.js`](https://github.com/video-dev/hls.js) si el navegador lo soporta (Chrome, Firefox, Edge); en Safari se usa reproducción nativa.
- **MPEG-TS / FLV (`.ts`, `.flv`)** → [`mpegts.js`](https://github.com/xqq/mpegts.js).
- **Otros formatos (`.mp4`, `.webm`, `.mkv`, `.mov`)** → `<video>` nativo.

El componente se carga con `next/dynamic` (`ssr: false`) porque estas librerías dependen de globals del navegador (`self`, `MediaSource`) y no pueden evaluarse en el servidor.

> Si un canal específico no carga, normalmente es porque esa fuente no tiene CORS habilitado para reproducción web — no es un problema de la app. El botón **Reintentar** vuelve a intentar la conexión ante cortes momentáneos de la señal.

---

## ⭐ Favoritos (sin base de datos)

Los favoritos se guardan en `localStorage` del navegador (clave `canalcasa:favorites`), identificados por la URL del stream. No se pierden al recargar la página, pero son locales a cada navegador/dispositivo.

---

## 📺 Optimización para TV

CanalCasa está diseñada para funcionar en Smart TVs y pantallas grandes.

### Navegación con control remoto

Durante la reproducción a pantalla completa
([`fullscreen-player.tsx`](src/components/fullscreen-player.tsx)):

| Tecla                    | Acción                                    |
|--------------------------|-------------------------------------------|
| `↑` `↓` `←` `→`          | Zapear al canal anterior / siguiente      |
| `Enter` / OK             | Abrir y cerrar la guía de canales         |
| `Espacio` / `K`          | Play / Pausa                              |
| `M`                      | Silenciar / activar sonido                |
| cualquier otra           | Despertar los controles                   |

Fuera del reproductor manda la navegación espacial
([`use-spatial-nav.ts`](src/hooks/use-spatial-nav.ts)): las flechas mueven el
foco entre piezas, y `Esc`, `Retroceso` o la tecla Atrás del mando (`GoBack`,
`BrowserBack`) vuelven atrás.

> Pantalla completa se pide con doble clic sobre el vídeo o con su botón, no
> con una tecla: `requestFullscreen` solo funciona dentro de un gesto.

### Buenas prácticas para TV

1. **Foco visible**: la pieza enfocada se ilumina con un borde **blanco** (`--foco-borde`) y crece un 6%. Es el gesto del televisor, y es uno solo en toda la app.
2. **Controles del reproductor**: Se auto-ocultan después de 4 segundos para no distraer.
3. **Tipografía fluida**: los tamaños van en `clamp()` contra el viewport, así que crecen solos en un televisor sin necesidad de un salto por resolución.
4. **Scroll suave**: El canal seleccionado siempre se mantiene visible con `scrollIntoView`.
5. **Reduced motion**: Respeta `prefers-reduced-motion` para usuarios sensibles.

---

## 🎨 Guía de estilos

Lenguaje de televisor: fondo negro real, foco como protagonista, texto siempre
debajo de la imagen. Los tokens viven en `src/app/shell.css`.

| Token             | Uso                                              |
|-------------------|--------------------------------------------------|
| `--bg` `#000`     | Fondo. Negro real: en un OLED se apaga del todo  |
| `--text` `#f5f5f7`| Texto principal                                  |
| `--muted` / `--soft` / `--faint` | Los tres escalones de menos presencia |
| `--gold` `#ffd60a`| Favoritos y valoraciones                         |
| `--red` `#ff453a` | El punto del directo                             |
| `--margen`        | Margen lateral **único** de toda la app          |
| `--foco-borde`    | Borde blanco de 4px del foco                     |

Dos hojas: `shell.css` (armazón) y `globals.css` (tokens, restablecimientos y
pantallas propias). El reparto y las trampas de la cascada están en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

---

## 🧑‍💻 Cómo agregar un campo a `Channel`

> ⚠️ **Piénsalo dos veces.** La lista se serializa entera dentro del HTML de la
> portada: un campo de treinta caracteres son 230 KB más que descargar y, sobre
> todo, **interpretar** — que en un televisor barato es lo que se nota. Si el
> valor se puede calcular en el cliente, calcúlalo ahí; si es constante, no lo
> mandes. Ya se retiraron cuatro campos por esto (`description`, `logoText`,
> `isFavorite`, `isLive`): sumaban 1,4 MB.

1. Actualiza `Channel` en `src/lib/types.ts` (`ParsedChannel` se deriva solo).
2. Llena el campo al construir el objeto en `parseM3uChannels` (`src/lib/m3u.ts`).
3. Si puede faltar, decláralo opcional y **omite la clave** en vez de asignar
   `undefined`: React lo serializa como el texto literal `"$undefined"`.

## 🧑‍💻 Cómo agregar un atajo de teclado

En [`src/components/fullscreen-player.tsx`](src/components/fullscreen-player.tsx),
dentro del `switch (event.key)` de `onKeyDown`:

```ts
case "r":
case "R":
  event.preventDefault();
  // Acción para la tecla R
  return;
```

Ojo con el `default`, que llama a `wake()`: cualquier tecla no reconocida
despierta los controles a propósito. Un `case` nuevo que no haga `return` se
comería también ese comportamiento.

---

## 👥 El equipo de agentes

Cinco agentes, cada uno dueño de una zona del código: canales, catálogo, diseño,
calidad y dispositivos. Quién es quién, cómo se invocan y las reglas que
comparten están en [`docs/EQUIPO.md`](docs/EQUIPO.md).

---

## 🧪 Verificación

```bash
npm run verify   # tipos + estilo + pruebas + compilación
```

`npm run build` es el que de verdad atrapa los fallos: este proyecto ya se cayó
en producción con un 500 porque `hls.js` y `mpegts.js` llegaron al paquete del
servidor.

Los componentes se comprueban con Playwright contra la app real, no con jsdom:
el detalle de por qué está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

---

## 📄 Licencia

Uso privado. Hecho para hogares guatemaltecos · Usa únicamente fuentes autorizadas.
