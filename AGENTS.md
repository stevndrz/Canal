<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CanalCasa — cómo se trabaja aquí

Este archivo lo leen solos Claude Code (por `CLAUDE.md`), OpenCode y Codex. Es
el único sitio con las reglas: no hace falta pegarlas en cada chat.

CanalCasa es una app familiar de tele en directo (lista M3U), películas y
series (TMDB + servidores externos) y «Ver juntos». Next.js 16 + React 19 en
Vercel; se usa en una tele (Samsung Tizen y TCL con la app de Android), un
iPhone y un PC con Windows. El dueño vive en Guatemala y habla español:
explícale en simple qué haces y por qué, y dile si hay una forma mejor.

## Una tarea = una rama = un PR

- **Nunca se trabaja en `main`.** Si estás en `main`, crea una rama antes de
  cambiar nada: `<rol>/<tema>` (por ejemplo `diseno/franja-canales`), desde el
  `main` más reciente.
- Un PR por tema, pequeño. **Nunca fusiones a `main`: fusiona el dueño.** Al
  fusionar, la rama se borra; no hay ramas permanentes por agente.
- Si `main` cambia y tu PR choca, trae `main` con un commit de fusión (no
  reescribas historial). No apiles un PR sobre otro.
- **`guia` no se toca**: la reescribe GitHub Actions cada día y de ahí lee la
  app la guía de canales.
- Antes de cada commit: `npm run verify` (tipos, lint, pruebas y build). Antes
  del PR, también `npm run e2e`. Di qué quedó sin probar.

## Roles

Un rol es un papel, no una rama. Si te dicen «Rol: X» (o «eres el agente X»),
lee **entera** su definición en `.claude/agents/X.md` y su memoria en
`docs/equipo/X.md` antes de tocar nada, y quédate en su zona. Al terminar,
anota en su memoria qué hiciste, qué decidiste y qué quedó pendiente.

| Rol | Zona | Memorias extra |
|---|---|---|
| `canales` | Tele en directo: `livetv/`, reproductores, M3U, EPG | `reproduccion.md`, `datos-m3u.md`, `epg-guia.md` |
| `catalogo` | Películas, series, ficha, proveedores, Mi enlace | `fuente-propia.md` |
| `diseno` | Cómo se ve todo. **Único que edita `shell.css` y `globals.css`** | |
| `calidad` | Pruebas, CI, código muerto, refactors **sin cambiar comportamiento** | |
| `config-seguridad` | Credenciales, cabeceras, CSP, `next.config.ts` | |
| `dispositivos` | Probar en iPhone, PC y tele. Encuentra, **no arregla** | |

Sin rol, haz la tarea igual con estas reglas. Si necesitas un cambio en la zona
de otro rol, dilo en el PR en vez de hacerlo.

## Reglas que no se discuten

- NO añadir campos al tipo `Channel`: viaja 7.822 veces en el HTML.
- Pregunta antes de cualquier cosa que pueda borrar datos de la familia
  (favoritos, último canal, recientes, historial de la sala, películas en R2)
  o que cambie lo que ven todos.
- Servidor de desarrollo: se para por PID (mira `ps`; nunca `pkill -f next`).
  Nada de `npm run build` con él encendido. Borra `.next` si cambian las rutas.
- CSS: colores solo de los tokens de `src/app/shell.css`, diffs pequeños.
- Variables nuevas: di nombre, tipo y entornos; nunca pidas el valor por chat.
- No extraer el vídeo de Vimeus ni esquivar sus anuncios o protecciones.
- Mensajes nuevos de la sala: que las versiones anteriores los ignoren sin
  romperse.
- Commits pequeños por tema, en español.

Más contexto: `docs/EQUIPO.md` (el equipo y cómo trabajar con Orca) y
`docs/ARQUITECTURA.md` (dónde vive cada cosa).
