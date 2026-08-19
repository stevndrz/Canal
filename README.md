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
├── scripts/
│   └── build-logo-index.mjs   # Regenera el índice de logos desde iptv-org
├── src/
│   ├── app/
│   │   ├── globals.css        # Estilos globales y utilidades
│   │   ├── layout.tsx         # Layout raíz con metadata
│   │   └── page.tsx           # Página principal (SSR): M3U + EPG -> Channel[]
│   ├── components/
│   │   ├── dashboard.tsx      # Estado, filtros y navegación por teclado
│   │   ├── channel-tile.tsx   # Tarjeta de canal + logo con respaldo
│   │   ├── quick-access.tsx   # Fila fija de canales principales
│   │   ├── shortcuts-panel.tsx# Panel de atajos de control remoto
│   │   └── stream-player.tsx  # Reproductor (solo cliente)
│   ├── hooks/
│   │   ├── use-cast.ts        # Chromecast / AirPlay / Remote Playback
│   │   ├── use-fullscreen.ts  # Pantalla completa (incluye iPhone)
│   │   └── use-favorites.ts   # Favoritos en localStorage
│   └── lib/
│       ├── m3u.ts             # Descarga y normaliza la lista M3U
│       ├── epg.ts             # Parser XMLTV opcional para horarios reales
│       ├── logos.ts           # Resolución de logos por nombre
│       ├── logo-index.json    # Índice de logos (generado, solo servidor)
│       ├── categories.ts      # Clasificación + paleta por categoría
│       ├── text.ts            # Normalización compartida de nombres
│       └── types.ts           # Tipos `ParsedChannel` / `Channel`
├── next.config.ts
├── package.json
└── tsconfig.json
```

No hay carpeta `api/`, `db/` ni variables `DATABASE_URL`: todo el estado vive en memoria del servidor (por request) y en `localStorage` del navegador para los favoritos.

---

## 📡 Reproducción de video

El reproductor (`src/components/stream-player.tsx`) reproduce las URLs del M3U **directamente**, sin proxy intermedio:

- **HLS (`.m3u8` o sin extensión, el caso más común en listas IPTV)** → [`hls.js`](https://github.com/video-dev/hls.js) si el navegador lo soporta (Chrome, Firefox, Edge); en Safari/iOS se usa reproducción nativa, que además habilita AirPlay.
- **MPEG-TS / FLV (`.ts`, `.flv`)** → [`mpegts.js`](https://github.com/xqq/mpegts.js).
- **Otros formatos (`.mp4`, `.webm`, `.mkv`, `.mov`)** → `<video>` nativo.

El componente se carga con `next/dynamic` (`ssr: false`) porque estas librerías dependen de globals del navegador (`self`, `MediaSource`) y no pueden evaluarse en el servidor.

**Recuperación de errores**: ante un fallo fatal de hls.js el reproductor no se rinde a la primera — reintenta hasta 3 veces (`startLoad()` en errores de red, `recoverMediaError()` en errores de medio) antes de mostrar la pantalla de error con el botón **Reintentar**. Los micro-cortes de señal, muy comunes en IPTV público, se resuelven solos.

> Si un canal concreto nunca carga, normalmente es porque esa fuente no tiene CORS habilitado o sirve por HTTP inseguro — no es un problema de la app.

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
| **AirPlay** | Safari / iPhone / iPad | `webkitShowPlaybackTargetPicker()` |
| **Remote Playback API** | Respaldo estándar donde exista | `video.remote.prompt()` |

El botón de transmitir solo aparece cuando hay alguna vía disponible. El SDK de Google Cast se carga de forma diferida y solo en navegadores Chromium; si no carga, no pasa nada.

---

## 🖼️ Logos de canales (para cualquier lista M3U)

Muchas listas —incluida la actual— no traen `tvg-logo`. El orden de resolución es:

1. `tvg-logo` de la lista, si viene.
2. Búsqueda por **nombre normalizado** en `src/lib/logo-index.json`, un índice de ~47.000 nombres generado desde la base de datos pública de [iptv-org](https://github.com/iptv-org/database).
3. **Monograma** con las iniciales del canal, coloreado según su categoría.

Medido contra los ~16.600 canales de las listas por país de iptv-org, el índice resuelve **~73%** de los logos (98% en la lista de Guatemala). Nunca falla de forma visible: si una imagen no carga, la tarjeta cae al monograma sin mostrar el ícono de imagen rota.

El índice se importa solo desde el servidor, así que **no se descarga al navegador**.

### Regenerar el índice

```bash
node scripts/build-logo-index.mjs
```

---

## ⚡ Acceso rápido

`FEATURED_CHANNEL_PATTERNS` en `src/lib/categories.ts` define los canales que aparecen fijos arriba (Canal 3, Canal 7, Guatevisión, TN23, Canal 11, Canal 13, Tigo Sports…). Se emparejan por nombre contra la lista cargada: los que no estén, simplemente no se muestran. Para cambiarlos, edita esa lista.

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
