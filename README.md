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
├── src/
│   ├── app/
│   │   ├── globals.css        # Estilos globales y utilidades
│   │   ├── layout.tsx         # Layout raíz con metadata
│   │   └── page.tsx           # Página principal (SSR, dynamic)
│   ├── components/
│   │   ├── dashboard.tsx      # Guía de canales: grid, categorías, favoritos
│   │   └── stream-player.tsx  # Reproductor (hls.js / mpegts.js), carga solo en cliente
│   └── lib/
│       ├── m3u.ts             # Descarga y normaliza la lista M3U (categorías, dedupe)
│       ├── epg.ts             # Parser XMLTV opcional para horarios reales
│       └── types.ts           # Tipo `Channel` compartido
├── next.config.ts
├── package.json
└── tsconfig.json
```

No hay carpeta `api/`, `db/` ni variables `DATABASE_URL`: todo el estado vive en memoria del servidor (por request) y en `localStorage` del navegador para los favoritos.

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

## 🗓️ Horarios de programación (EPG)

El formato M3U (`#EXTINF`) no trae horarios — solo nombre, logo y categoría. Los horarios reales vienen de un archivo aparte en formato **XMLTV**, que muchas listas públicas referencian en su primera línea:

```
#EXTM3U url-tvg="https://ejemplo.com/epg.xml.gz"
```

`src/lib/m3u.ts` detecta automáticamente ese atributo (`url-tvg`, `x-tvg-url` o `tvg-url`) y, si existe, `src/lib/epg.ts` descarga y parsea la guía (soporta gzip, con un límite de 15MB) para mostrar **"Al aire" / "Sigue"** con la programación real de cada canal, emparejando por `tvg-id`.

Si tu lista M3U no referencia ningún EPG, esa sección simplemente no aparece — la app nunca inventa horarios de relleno.

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
