# Prompt para el siguiente chat (preparado el 2026-11-09)

Copiar desde aquí:

---

Proyecto: CanalCasa (repo stevndrz/Canal, Next.js 16.4 — lee AGENTS.md y
`node_modules/next/dist/docs/` antes de escribir código de Next). Soy el dueño,
vivo en Guatemala, uso Windows 11 con GPU NVIDIA, un iPhone y una tele Samsung
(Tizen). Explícame en simple qué haces y por qué, dame tu opinión y, si hay una
forma mejor de lo que pido, dímela. Lee primero `docs/equipo/catalogo.md`,
`docs/equipo/diseno.md` y `docs/PELICULAS-JUNTOS.md`: ahí está el detalle.

## Estado al empezar (comprueba en GitHub qué está fusionado)
- **Ver juntos** (Mi enlace): sala con **código de 4 cifras** por sala y **alias**
  por persona (sin PIN de Vercel). Pusher, canal de presencia
  `presence-juntos-NNNN`; firma en `src/app/api/pusher/auth/route.ts`. Dirige
  quien eligió la película (`quienDirige`); la última elegida manda
  (`masNueva`/`esMasNueva`, versión entera); cuenta atrás 3·2·1. Eco por estado
  esperado (`lib/ver-juntos/eco.ts`), salto aparcado hasta `loadedmetadata`,
  arranque en silencio si no hay gesto (iPhone), reconexión al volver de segundo
  plano. Código: `src/hooks/use-ver-juntos.ts`, `src/lib/ver-juntos/*`,
  `src/components/views/{fuente-view,sala-cine,entrar-sala}.tsx`.
- **Mi enlace = «sala de cine»** (PR #86): el reproductor es el protagonista de
  la portada (modo teatro en PC/móvil, pantalla completa sola en la tele), fondo
  TMDB difuminado, halo con los colores de la película (`Halo` en
  `sala-cine.tsx`, no en tele), estante de pósters, «Usar un enlace» en una hoja.
  CSS en la familia `.cine-*` de `globals.css` (dueño: agente `diseno`).
- **Nuestras películas** (R2): **Sincronizar** (PR #87) — `Descargas\Peliculas`
  es la biblioteca; `Sincronizar peliculas.cmd` (Node, `scripts/peliculas/sincronizar/`)
  sube, actualiza subtítulos, renombra y pregunta antes de borrar; sube a
  carpetas `<id>-<huella>` y verifica con `rclone check` antes de tocar el
  catálogo. 46 pruebas, una de punta a punta con ffmpeg real.
- **Vimeus con cuenta propia** (PR #88): `vimeus.net` + view key de la casa;
  404 exacto por episodio → ya no sale «Not Found»; **series y anime en latino**
  (`vimeus` y `vimeus-anime`, la comprobación deja la ruta buena); marca
  «Latino»; API (`VIMEUS_API_KEY`, `src/lib/catalog/vimeus.ts`): riel «Recién
  llegadas en latino» y marca «Latino» por episodio. La respuesta real de la API
  es `data.result`/`data.pages` (su documentación está desactualizada).
- Variables en Vercel ya puestas por mí: `NEXT_PUBLIC_PUSHER_KEY`,
  `NEXT_PUBLIC_PUSHER_CLUSTER`, `PUSHER_SECRET`, `NEXT_PUBLIC_PELICULAS_URL`,
  `VIMEUS_API_KEY` (y opcional `NEXT_PUBLIC_VIMEUS_VIEW_KEY`). Nuevas: dime
  nombre, tipo y entornos; nunca me pidas el valor por el chat (en el contenedor,
  usa el formulario seguro de credenciales).

## Lo que quedó abierto (empieza por aquí)
1. **¿Ver juntos con Vimeus?** Su reproductor vive en un iframe de otro dominio:
   desde fuera no se lee ni se controla el `<video>`. Lo que se vio: la página
   del embed carga un solo módulo (`/player-assets/index-v2.js`) y en su HTML no
   hay `postMessage`. Antes de prometer nada: (a) mira si ese JS escucha
   `message` y con qué formato (sería sincronía real: play/pausa/salto); (b) si
   no, propón la «sincronía suave»: la sala manda el mismo título/episodio a
   todos, cuenta atrás y arrancan a la vez, con un botón «estoy aquí / voy por»
   para reajustar a mano; (c) pregunta a Vimeus si su reproductor tiene API de
   control para socios (la doc nombra rutas `/cf/*` con `cf`, `pc`, `claim`,
   `play_claim` y `with_cf=true` sin explicarlas: averigua qué son).
2. **Anuncios y teles viejas.** Postura honesta: no extraer el vídeo de Vimeus
   para saltarse su publicidad (es su modelo de negocio y rompe sus condiciones;
   además ya se probó un proxy que reescribía su HTML y rompió JWPlayer). Vías
   legítimas, en este orden: (a) preguntar a Vimeus por un plan sin anuncios o
   sin pop-ups para socios con API key; (b) su personalización oficial del
   reproductor (`theme`, `logo_url`, `primary_color` en el `embed_url`); (c) en
   la tele, que lo que tenga que ser sin anuncios y sincronizado sea **Nuestras
   películas** (HLS propio en R2), y hacer que subir una sea trivial.
3. **Probar en aparatos reales**: Ver juntos en iPhone (lista de 5 pasos en el
   PR del iPhone) y en la tele Samsung; Vimeus en la tele (¿acepta el dominio de
   la app de Tizen con la view key?); la marca «Latino» por episodio en una ficha.
4. **Primera vuelta de Sincronizar en el PC**: `preparar-pc.ps1` →
   «Mirar que cambiaria.cmd» (debe decir solo «Reconocer The Hunger Games:
   Catching Fire») → «Sincronizar peliculas.cmd». Si algo falla, el registro
   está en `%LOCALAPPDATA%\CanalCasa\registro\`.

## Ideas para innovar (propón, ordena por valor/esfuerzo y pregúntame)
- **Sincronizar sola**: tarea programada de Windows o vigilar la carpeta al
  terminar una descarga; aviso en el teléfono cuando una película ya está lista.
- **Subtítulos automáticos**: buscarlos en OpenSubtitles (API con clave) al
  sincronizar, y alinearlos solos con `alass` contra el audio.
- **Ver juntos con voz o reacciones**: emojis flotantes y un «¡pausa!» por voz
  desde el teléfono que actúa como mando de la tele (el teléfono controla, la
  tele reproduce).
- **«Seguir viendo juntos»**: la sala recuerda por dónde iban y ofrece
  retomarlo; historial de lo visto juntos.
- **Riel «Para esta noche»**: mezcla de Nuestras películas + recién llegadas en
  latino + lo que dejaron a medias, según la hora y quién está en la sala.
- **Página «Todas en latino»** paginando la API de Vimeus, con filtro por género
  (cruzando con TMDB) y búsqueda.
- **Mando desde el teléfono** para la tele en general (no solo en la sala):
  emparejar con el mismo código de 4 cifras.
- **Rendimiento en teles viejas**: medir con Lighthouse en Tizen; servir
  pósters más pequeños en tele; quitar lo que no se usa en el reproductor.
- **Seguridad pendiente**: activar en GitHub Secret scanning, Push protection y
  Dependabot; en Vercel, regla de rate limiting en `/api/*`; rotar la llave de
  R2 si se creó con `rclone config create … secret_access_key` (queda en el
  historial de PowerShell; la guía explica cómo limpiarlo).

## Reglas (obligatorias)
- NO añadir campos al tipo `Channel`.
- Si algo puede borrar datos de la familia (favoritos, último canal, recientes,
  películas en R2) o cambia lo que ven todos, pregunta antes.
- Servidor de desarrollo: pararlo por PID (mira `ps` y qué es cada PID; nunca
  `pkill -f next`). No `npm run build` con él encendido. Borrar `.next` si
  cambian rutas. En el contenedor, el `fetch` de Node no usa el proxy: para
  probar con credenciales inyectadas, `NODE_USE_ENV_PROXY=1 npm run dev`.
- CSS: solo `backdrop-filter` (sin `-webkit-`); colores solo de tokens de
  `src/app/shell.css`; diffs pequeños. `diseno` es el dueño de
  shell.css/globals.css; `dispositivos` prueba en iPhone/PC/tele.
- Scripts de Windows en PowerShell 5.1: BOM UTF-8, `$ErrorActionPreference =
  "Continue"`, y las variables no distinguen mayúsculas. Lo nuevo del PC va en
  Node (`scripts/peliculas/sincronizar/`), con pruebas.
- Antes de cada push: `npm run typecheck && npm run lint && npm test`;
  `npm run build` antes del PR. Revisa la salida completa.
- Commits pequeños por tema, en español. Diarios en `docs/equipo/`.
- Prueba de verdad (Playwright con varios aparatos y el Pusher simulado con
  `routeWebSocket` que comprueba la firma; rclone falso para el PC) y dime qué
  quedó sin probar.
- Rama nueva desde `main` por tema y un PR por tema para que yo lo revise.

---
