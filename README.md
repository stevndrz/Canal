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
2. (Opcional) En **Settings → Environment Variables**, define `M3U_URL` si quieres apuntar a una lista distinta a la que trae el código por defecto, y/o `EPG_URL` para horarios reales (ver [Horarios de programación](#️-horarios-de-programación-epg)).
3. Despliega. No hace falta configurar ninguna base de datos: la lista de canales se descarga en cada request (`revalidate: 300`) directamente desde la URL del M3U.

### Actualizar la lista de canales

No hace falta redesplegar ni tocar el código:

1. Edita el archivo M3U que apunta `M3U_URL` (o el Gist por defecto).
2. Agrega/quita bloques `#EXTINF` con su URL de stream.
3. Guarda los cambios. La página los recoge automáticamente (caché de 5 min).

La importación elimina duplicados por URL de stream, quita sufijos de calidad del nombre (ej. "Canal 3 (720p)" → "Canal 3"), filtra contenido para adultos, y organiza los canales priorizando Guatemala, deportes, noticias, películas/series, documentales, infantil, música, religión, entretenimiento e idioma.

---

## 🛠️ Scripts disponibles

| Comando            | Descripción                                        |
|--------------------|----------------------------------------------------|
| `npm run dev`      | Inicia el servidor de desarrollo (Turbo)           |
| `npm run build`    | Compila la aplicación para producción              |
| `npm run start`    | Inicia el servidor de producción                   |
| `npm run lint`     | Ejecuta ESLint                                     |
| `npm run typecheck`| Verifica tipos con TypeScript                      |

---

## 🏗️ Arquitectura del proyecto

```
Canal/
├── scripts/build-logo-index.mjs   # Regenera el índice de logos desde iptv-org
├── tizen/                         # Contenedor .wgt para Samsung Smart TV
├── src/
│   ├── app/
│   │   ├── page.tsx                        # Canales (SSR)
│   │   ├── peliculas/page.tsx              # Catálogo
│   │   ├── peliculas/[mediaType]/[id]/     # Ficha + reproductor
│   │   └── api/pusher/auth/route.ts        # Auth del Watch Party
│   ├── components/
│   │   ├── dashboard.tsx           # Estado, filtros y navegación por teclado
│   │   ├── channel-tile.tsx        # Tarjeta de canal + logo con respaldo
│   │   ├── quick-access.tsx        # Fila fija de canales principales
│   │   ├── sticky-player-frame.tsx # Miniatura al recorrer la guía
│   │   ├── display-settings.tsx    # Modo TV y nitidez
│   │   ├── stream-player.tsx       # Reproductor de canales en vivo
│   │   ├── native-player.tsx       # Reproductor de enlaces propios
│   │   └── catalog/                # Pósters, filas y ficha de detalle
│   ├── hooks/
│   │   ├── use-cast.ts             # Chromecast / AirPlay / Remote Playback
│   │   ├── use-fullscreen.ts       # Pantalla completa (incluye iPhone)
│   │   ├── use-favorites.ts        # Favoritos (respaldados por el store)
│   │   ├── use-grid-navigation.ts  # Navegación espacial por flechas
│   │   └── use-watch-party.ts      # Sincronización por Pusher
│   ├── store/use-app-store.ts      # Zustand + persist
│   ├── data/catalog.json           # Catálogo de películas y series
│   └── lib/
│       ├── m3u.ts / epg.ts / logos.ts / categories.ts / text.ts
│       ├── catalog/                # Tipos, TMDB y proveedores de iframe
│       └── watch-party/sign.ts     # Firma HMAC de canales privados
├── next.config.ts
├── package.json
└── tsconfig.json
```

No hay carpeta `api/`, `db/` ni variables `DATABASE_URL`: todo el estado vive en memoria del servidor (por request) y en `localStorage` del navegador para los favoritos.

---

## 📡 Reproducción de video

El reproductor (`src/components/stream-player.tsx`) reproduce las URLs del M3U **directamente**, sin proxy intermedio:

- **HLS (`.m3u8` o sin extensión, el caso más común en listas IPTV)** → reproducción **nativa** en Safari/iOS (necesaria para AirPlay, ver abajo); [`hls.js`](https://github.com/video-dev/hls.js) en el resto (Chrome, Firefox, Edge).
- **MPEG-TS / FLV (`.ts`, `.flv`)** → [`mpegts.js`](https://github.com/xqq/mpegts.js).
- **Otros formatos (`.mp4`, `.webm`, `.mkv`, `.mov`)** → `<video>` nativo.

El componente se carga con `next/dynamic` (`ssr: false`) porque estas librerías dependen de globals del navegador (`self`, `MediaSource`) y no pueden evaluarse en el servidor.

**Recuperación de errores**: ante un fallo fatal de hls.js el reproductor no se rinde a la primera — reintenta hasta 3 veces (`startLoad()` en errores de red, `recoverMediaError()` en errores de medio) antes de mostrar la pantalla de error con el botón **Reintentar**. Los micro-cortes de señal, muy comunes en IPTV público, se resuelven solos.

> Si un canal concreto nunca carga, normalmente es porque esa fuente no tiene CORS habilitado o sirve por HTTP inseguro — no es un problema de la app.

---

## 🎬 Películas y Series

Catálogo híbrido definido a mano en `src/data/catalog.json`. Cada ficha se
reproduce de una de dos formas:

| Fuente | Cómo se reproduce | Watch Party |
|---|---|---|
| `embed` | iframe del proveedor externo, con sus propios controles | El del proveedor |
| `manual` | Reproductor nativo propio (`.mp4` / `.m3u8`) | El nuestro, sincronizado |

Los metadatos (título, póster, sinopsis, temporadas y episodios) los rellena
**TMDB** a partir del `tmdbId`; lo que escribas en el JSON siempre manda sobre
lo que devuelva la API, para poder corregir un título o apuntar a un doblaje
concreto. Sin `TMDB_API_KEY` la sección sigue funcionando con lo que haya en el
JSON y lo avisa en pantalla.

Los proveedores de iframe **no están escritos en el código**: se configuran con
`NEXT_PUBLIC_EMBED_PROVIDER_MOVIE` y `NEXT_PUBLIC_EMBED_PROVIDER_TV`, así se
cambia de proveedor —o se apunta a un servidor propio— sin recompilar. Conviene
tener presente que muchos servicios de ese tipo distribuyen cine y series sin
licencia; la arquitectura sirve igual para contenido propio.

### Reproductor nativo (solo para enlaces propios)

- **Pistas de audio** desde `hls.audioTracks`. Solo aparece si el archivo trae
  más de una: Chrome no expone `video.audioTracks`, así que en reproducción
  nativa el selector se oculta en vez de dejar un control muerto.
- **Subtítulos** `.vtt` declarados en el JSON, conmutables desde el reproductor.
- **Barra de progreso**: un canal en vivo no se busca, una película sí.

---

## 👨‍👩‍👧 Watch Party (Pusher)

Sincroniza play, pausa y posición entre navegadores, **solo en los enlaces
propios**: en las fichas `embed` manda el reproductor del proveedor.

Se usan **client events sobre un canal privado**, así los mensajes viajan de
navegador a navegador a través de Pusher sin pasar por nuestro servidor: sin
coste por evento y con menos latencia. `/api/pusher/auth` solo firma la
suscripción (HMAC-SHA256 de `socket_id:canal`), y para eso no hace falta el SDK
de servidor de Pusher.

Detalles que evitan que se sienta a tirones:

- **Tolerancia de 1,5 s**: corregir cada diferencia mínima daría saltos
  constantes.
- **Compensación de latencia** con la marca de tiempo del mensaje.
- **Supresión de eco**: al aplicar un cambio recibido el `<video>` dispara sus
  propios eventos; sin una ventana de silencio se reenviarían y los
  participantes entrarían en un bucle.

> Hay que activar **"Enable client events"** en el panel de Pusher
> (App Settings). `pusher-js` se carga solo al entrar en una sala.

---

## 📺 Miniatura y vuelta arriba

Al bajar por la guía el reproductor se encoge a una esquina y **sigue
reproduciendo**: se mueve el contenedor, nunca el `<video>` en el DOM, porque
cambiarlo de sitio hace que el navegador reinicie la carga y en un directo eso
son varios segundos en negro.

Al elegir un canal la página vuelve arriba, donde está la imagen: quien acaba
de cambiar de canal espera verlo, no quedarse a mitad de la guía.

---

## 📱 Pantalla completa y transmitir a la TV

### Pantalla completa (incluye iPhone)

`src/hooks/use-fullscreen.ts` intenta, en orden: `requestFullscreen()` estándar → `webkitRequestFullscreen()` → `video.webkitEnterFullscreen()`.

Ese último paso es el que hace que **funcione en iPhone**: Safari en iOS no implementa la Fullscreen API sobre elementos normales (un `<div>` no tiene `requestFullscreen`), así que la única vía es pedirle pantalla completa al propio `<video>`, que abre el reproductor nativo del sistema. Si ninguna vía existe, el botón se oculta en vez de quedarse sin hacer nada.

### Transmitir a la TV

`src/hooks/use-cast.ts` cubre las tres vías que existen en navegadores:

| Vía | Dónde funciona | Cómo |
|-----|----------------|------|
| **Google Cast** | Chrome (escritorio) y Android | Manda la URL del stream al Chromecast, así que funciona aunque localmente se reproduzca con hls.js/MSE |
| **AirPlay** | Safari / iPhone / iPad | `webkitShowPlaybackTargetPicker()` sobre reproducción HLS **nativa** |
| **Remote Playback API** | Respaldo estándar donde exista | `video.remote.prompt()` |

El botón de transmitir solo aparece cuando hay alguna vía disponible. El SDK de Google Cast se carga de forma diferida y solo en navegadores Chromium; si no carga, no pasa nada.

> **AirPlay necesita reproducción nativa.** El Apple TV reproduce una URL, no
> un buffer: si el `<video>` se alimenta por MSE (Media Source Extensions),
> AirPlay solo consigue llevarse el audio y la TV se queda en negro. Y esto
> pasa en iPhone más de lo que parece: desde iOS 17.1 Safari expone
> `ManagedMediaSource`, que hls.js acepta como MSE, así que `Hls.isSupported()`
> devuelve `true` también en el teléfono. Por eso `shouldUseNativeHls()` en
> `stream-player.tsx` comprueba **primero** si el navegador reproduce HLS de
> forma nativa y solo cae en hls.js cuando no puede.

---

## 🖼️ Logos de canales (para cualquier lista M3U)

No todas las listas traen `tvg-logo` (el Gist actual sí; el anterior no). El orden de resolución es:

1. `tvg-logo` de la lista, si viene.
2. Búsqueda por **nombre normalizado** en `src/lib/logo-index.json`, un índice de ~47.000 nombres generado desde la base de datos pública de [iptv-org](https://github.com/iptv-org/database).
3. **Monograma** con las iniciales del canal, coloreado según su categoría.

Cuando la lista no trae logos, medido contra los ~16.600 canales de las listas por país de iptv-org, el índice resuelve **~73%** (98% en la lista de Guatemala). Con el Gist actual, que sí los trae, la cobertura total sube al **87%**. Nunca falla de forma visible: si una imagen no carga, la tarjeta cae al monograma sin mostrar el ícono de imagen rota.

El índice se importa solo desde el servidor, así que **no se descarga al navegador**.

### Regenerar el índice

```bash
node scripts/build-logo-index.mjs
```

---

## 🚀 Rendimiento con listas grandes

Probado con **12.718 canales** (una lista M3U de 1,6 MB):

| | Antes | Después |
|---|---|---|
| HTML enviado al navegador | 28,2 MB | 4,2 MB (0,6 MB con gzip) |
| Tiempo de respuesta | 3–7 s | ~0,5 s |
| Interpretar la lista | 2447 ms | 385 ms |

Con el Gist actual (15.556 canales, ya con `tvg-id` y `tvg-logo`): ~300 ms de
parseo, 5,0 MB de HTML (0,66 MB con gzip) y **87% de logos** resueltos.

Tres cambios lo hacen posible:

1. **La guía se pinta por tandas** de 120 tarjetas y crece al llegar al final
   (`IntersectionObserver`). Pintar 12.718 de golpe generaba decenas de MB de
   HTML y bloqueaba teléfonos y TVs viejas. La búsqueda y los filtros siguen
   siendo instantáneos porque la lista completa vive en memoria.
2. **Un `Intl.Collator` reutilizado** en vez de `String.localeCompare`, que
   reconstruye el colador en cada comparación: 1289 ms → 48 ms al ordenar.
3. **Caché del parseo en memoria del proceso**, así solo la primera visita tras
   un cambio de lista paga el costo.

---

## ⚡ Acceso rápido

`FEATURED_CHANNEL_PATTERNS` en `src/lib/categories.ts` define los canales que aparecen fijos arriba (Canal 3, Canal 7, Guatevisión, TN23, Canal 11, Canal 13, Tigo Sports…). Se emparejan por nombre contra la lista cargada: los que no estén, simplemente no se muestran. Para cambiarlos, edita esa lista.

### Cómo se decide que un canal es de Guatemala

Media Latinoamérica tiene un "Canal 3" o un "Canal 13", así que adivinar por el
nombre llenaba la categoría prioritaria de canales de Formosa, Jujuy o Chiapas.
`classifyChannel()` resuelve así:

1. **Si la lista dice el país, ese dato manda** y el nombre ni se consulta. El
   país sale de `tvg-country` o, si no está, del sufijo del `tvg-id`
   (`Canal3.gt@SD` → `gt`), que es el formato de las listas estilo iptv-org.
   Así "Tigo Sports" de Bolivia o "Canal 3" de Formosa no acaban en Guatemala.
2. **Si no hay país**, se cae a señales por nombre: las inequívocas
   (`guatemala`, `chapin`, `guatevision`, `tn23`, `totovision`, `tigo sports`)
   valen en cualquier parte, y las genéricas (`Canal 3`, `Canal 7`, `Canal 11`,
   `Canal 13`, `Canal 27`) solo si el canal se llama **exactamente** así.

Medido sobre 15.556 canales internacionales en el formato del Gist actual:
66 canales en la categoría Guatemala y **cero falsos positivos**.

El acceso rápido se restringe además a esa categoría, para no ofrecer como
atajo un "Canal 11" que en realidad es de otro país.

---

## ⭐ Favoritos (sin base de datos)

Los favoritos se guardan en `localStorage` del navegador (clave `canalcasa:favorites`), identificados por la URL del stream. No se pierden al recargar la página, pero son locales a cada navegador/dispositivo.

---

## 🗓️ Horarios de programación (EPG)

El formato M3U (`#EXTINF`) no trae horarios — solo nombre, logo y categoría. Los horarios reales vienen de un archivo aparte en formato **XMLTV**, que muchas listas públicas referencian en su primera línea:

```
#EXTM3U url-tvg="https://ejemplo.com/epg.xml.gz"
```

Si tu M3U trae esa línea, `src/lib/m3u.ts` la detecta sola (`url-tvg`, `x-tvg-url` o `tvg-url`). Si no la trae (como el Gist actual), puedes fijar una guía manualmente con la variable de entorno **`EPG_URL`** — por ejemplo, la de Guatemala en [iptv-epg.org/guides](https://iptv-epg.org/guides). En Vercel: **Settings → Environment Variables → `EPG_URL`**.

`src/lib/epg.ts` descarga y parsea esa guía (soporta gzip, con un límite de 15MB) para mostrar **"Al aire" / "Sigue"** con la programación real de cada canal:

- Si el canal tiene `tvg-id` en el M3U, empareja por ese id (lo ideal).
- Si no lo tiene (caso del Gist actual, que no trae `tvg-id`), empareja por **nombre normalizado** contra el `<display-name>` de la guía XMLTV — ej. "Canal 3" del M3U encuentra "Canal 3 de Guatemala" en la guía. Es un emparejamiento best-effort: puede no encontrar todos los canales, pero nunca inventa horarios — si no hay coincidencia, esa sección simplemente no aparece.

---

## 📺 Optimización para TV

CanalCasa está diseñada para funcionar en Smart TVs y pantallas grandes.

### Navegación con control remoto

| Tecla          | Acción                          |
|----------------|----------------------------------|
| `↑` / `↓`      | Cambiar canal en la lista       |
| `PgUp` / `PgDn`| Salto de 10 canales             |
| `← / →`        | Cambiar categoría                |
| `0-9`          | Ir directamente a un canal      |
| `Espacio` / `K`| Play / Pausa                    |
| `M`            | Silenciar / Activar sonido      |
| `F`            | Pantalla completa               |
| `Enter`        | Marcar/quitar favorito           |
| `?`            | Mostrar atajos de teclado       |
| `Esc`          | Cerrar paneles                  |

### Buenas prácticas para TV

1. **Foco visible**: Todos los elementos interactivos tienen `focus-visible` con anillo verde.
2. **Controles del reproductor**: Se auto-ocultan después de 4 segundos para no distraer.
3. **Tipografía grande**: En pantallas ≥1280px el texto base aumenta a 16px.
4. **Scroll suave**: El canal seleccionado siempre se mantiene visible con `scrollIntoView`.
5. **Reduced motion**: Respeta `prefers-reduced-motion` para usuarios sensibles.

---

## 🎨 Guía de estilos

| Color        | Uso                          |
|--------------|-------------------------------|
| `#168766`    | Verde primario (acciones)    |
| `#34d399`    | Verde claro (foco, acentos)  |
| `#f4f7f6`    | Fondo claro                  |
| `#f59e0b`    | Ámbar (favoritos)            |

Fuente: `ui-sans-serif, system-ui, -apple-system, ...`. Utilidades relevantes: `.scrollbar-none`, `.channel-tile` (renderizado eficiente de guías con cientos de canales).

---

## 🧑‍💻 Cómo agregar un campo a `Channel`

1. Actualiza `ParsedM3uChannel` en `src/lib/m3u.ts` y `Channel` en `src/lib/types.ts`.
2. Llena el campo al construir el objeto en `parseM3uChannels` (`src/lib/m3u.ts`).
3. Úsalo donde haga falta en `src/components/dashboard.tsx` o `stream-player.tsx`.

## 🧑‍💻 Cómo agregar un atajo de teclado

En `src/components/dashboard.tsx`, dentro del `useEffect` de `handleKeyDown`:

```ts
if (e.key === "r" || e.key === "R") {
  // Acción para la tecla R
  return;
}
```

---

## 🧪 Verificación

```bash
npm run typecheck
npm run lint
npm run build
```

---

## 📄 Licencia

Uso privado. Hecho para hogares guatemaltecos · Usa únicamente fuentes autorizadas.
