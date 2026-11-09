# Prompt para el siguiente chat (modo plan)

Cópialo entero en un chat nuevo, en modo plan.

---

Proyecto: CanalCasa (repo stevndrz/Canal, Next.js 16.4 + React 19, desplegado en Vercel). Antes de escribir código de Next, lee AGENTS.md y `node_modules/next/dist/docs/`. Soy el dueño, vivo en Guatemala, uso Windows 11 con GPU NVIDIA, un iPhone y una tele Samsung (Tizen). Explícame en simple qué haces y por qué, dame tu opinión y, si hay una forma mejor de lo que pido, dímela.

**Estás en modo plan: no toques código.** Lee primero, en este orden: `docs/VIMEUS-JUNTOS.md`, `docs/PELICULAS-JUNTOS.md`, `docs/ARQUITECTURA.md`, `docs/EMPAQUETADO.md`, `docs/SEGURIDAD.md`, `docs/SALUD-CODIGO.md` y `docs/equipo/*.md` (sobre todo catalogo, diseno, dispositivos y calidad). Comprueba en GitHub qué está fusionado. Ojo: el commit «Vimeus y Ver juntos…» está en la rama `claude/siguiente-chat` sin PR; ábrelo o inclúyelo en tu primer PR.

### Lo que quiero que planifiques (tres partes)

**1. Nuestras películas como experiencia principal de Ver juntos.**
Lo que va sin anuncios y perfectamente sincronizado es la película subida a R2. Planifica cómo hacer que eso sea lo central y lo más fácil:
- Sincronizar sola: tarea programada de Windows o vigilar `Descargas\Peliculas` cuando termine una descarga, con un aviso al teléfono cuando la película ya esté lista. En Node, en `scripts/peliculas/sincronizar/`, con pruebas.
- Que en Mi enlace / sala de cine se vea primero «Nuestras películas».
- «Seguir viendo juntos»: la sala recuerda por dónde iban y ofrece retomarlo, más un historial.
- Subtítulos automáticos (OpenSubtitles + `alass`): solo si cabe. Dime qué clave haría falta (nombre, tipo y entornos; nunca me pidas el valor por el chat).

**2. Sincronía suave con Vimeus, como extra pequeño.**
Su reproductor no acepta mando (está explicado en `docs/VIMEUS-JUNTOS.md`). Diseña lo mínimo: un botón «Listo» después de los anuncios, cuenta atrás 3·2·1, un reloj de sala «Deberían ir por 12:34», «Pausa para todos» y «Voy por…». Que se reaproveche lo que ya existe (`src/hooks/use-ver-juntos.ts`, `src/lib/ver-juntos/*`, `sala-cine.tsx`) y que sea discreto: no debe competir con Nuestras películas.

**3. ¿Seguimos con Next.js o migramos? Y lo crítico del proyecto.**
Quiero algo más rápido y fiable, sobre todo en teles viejas (Tizen, Chrome 53+), en el iPhone y en el arranque. **Decide con datos, no por moda.**
- Mide primero: el tamaño del JS que llega al cliente por ruta (`npm run analyze`), los tiempos de carga y de interacción en un perfil de tele lenta (Playwright con CPU frenada), el arranque en frío de `/api/*` en Vercel y los errores reales (`get_runtime_errors` y los logs de Vercel).
- Compara de verdad al menos estas opciones: (a) seguir con Next y adelgazarlo (menos JS de cliente, quitar lo que no se usa, pósters más pequeños en la tele); (b) una SPA con Vite + React o Preact y una API pequeña (Hono en funciones de Vercel); (c) Astro o similar para la carcasa de la tele. Para cada una: velocidad esperada, esfuerzo en días, riesgo, qué se rompe (la credencial de TMDB, `/api/canales`, `/api/stream`, Pusher, el `.wgt` y el `.apk`) y si se puede migrar por partes.
- Si un lenguaje de servidor distinto (Go o Rust) no aporta nada para dos o tres personas, dilo claramente.
- Haz un repaso de lo crítico, ordenado por riesgo × valor: seguridad (Secret scanning, Push protection, Dependabot, límite de peticiones en `/api/*`, la llave de R2 en el historial de PowerShell), fiabilidad de la reproducción (canales y Ver juntos), deuda técnica (los hotspots de CodeScene en `docs/SALUD-CODIGO.md`), pruebas que falten y lo que nunca se probó en aparatos reales (lista de iPhone/tele de `docs/equipo/dispositivos.md`).

### Cómo quiero el plan
- Una tabla final con cada tarea: valor, esfuerzo, riesgo, el orden que propones y si es un PR propio.
- Hazme preguntas (AskUserQuestion) donde haya una decisión mía, por ejemplo si migramos o no.
- Di qué quedaría sin probar y qué tengo que hacer yo (en el PC, en la tele o en Vercel).

### Reglas (obligatorias al ejecutar)
- NO añadir campos al tipo `Channel`.
- Pregunta antes de cualquier cosa que pueda borrar datos de la familia (favoritos, último canal, recientes, películas en R2) o que cambie lo que ven todos.
- Servidor de desarrollo: se para por PID (mira `ps` y qué es cada PID; nunca `pkill -f next`). Nada de `npm run build` con él encendido. Borra `.next` si cambian las rutas. En el contenedor, el `fetch` de Node no usa el proxy: `NODE_USE_ENV_PROXY=1 npm run dev`.
- CSS: solo `backdrop-filter` (sin `-webkit-`), colores solo de los tokens de `src/app/shell.css`, diffs pequeños. `diseno` es el dueño de shell.css y globals.css; `dispositivos` prueba en iPhone, PC y tele.
- Scripts de Windows en PowerShell 5.1: BOM UTF-8, `$ErrorActionPreference = "Continue"`. Lo nuevo del PC va en Node, con pruebas.
- Antes de cada push: `npm run typecheck && npm run lint && npm test`; `npm run build` antes del PR. Revisa la salida completa.
- Commits pequeños por tema, en español. Diarios en `docs/equipo/`.
- Prueba de verdad: Playwright con varios aparatos y el Pusher simulado con `routeWebSocket` que comprueba la firma; rclone falso para el PC. Dime qué quedó sin probar.
- Una rama nueva desde `main` por tema y un PR por tema para que yo lo revise.
- Variables nuevas: dime nombre, tipo y entornos; nunca me pidas el valor por el chat (en el contenedor, usa el formulario seguro de credenciales).
- No extraer el vídeo de Vimeus ni esquivar sus anuncios o protecciones.
