# Memoria de `config-seguridad`

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

No tengo definición en `.claude/agents/` todavía — no existía como agente del
equipo antes de esta sesión (ver `docs/EQUIPO.md`, que solo lista `canales`,
`catalogo`, `diseno`, `calidad`, `dispositivos`). Tampoco existe `MAIN.md` en
ningún punto del historial ni de las ramas. Uso `docs/SEGURIDAD.md` y
`docs/EQUIPO.md` como contexto equivalente hasta que alguien decida si este rol
se formaliza con su propia definición de agente.

---

## Mi zona

Credenciales expuestas, cabeceras de seguridad (`next.config.ts`), y lo que
`docs/SEGURIDAD.md` marca como pendiente en la sección «Lo que hay que hacer y
no es código».

---

## Decisiones tomadas

- **No reescribir el historial de Git para «borrar» un secreto filtrado.**
  Clones y forks existentes ya lo tienen; lo único que lo neutraliza es
  rotarlo. Coincide con lo que ya decía `docs/ARQUITECTURA.md`.
- **La CSP sin `script-src`/`media-src`/`connect-src` es una decisión
  aceptada, no un hueco por cerrar.** `next.config.ts` ya la documenta:
  `script-src` con nonce rompe `cacheComponents` (PPR), y `media-src` fijo
  rompería canales cuando un proveedor rota de dominio sin aviso. No lo toqué.

---

## Diario

Lo más reciente arriba.

### 2026-08-31 — Auditoría de credenciales + rotación TMDB confirmada

- Escaneé el árbol versionado completo (AWS keys, private keys, `ghp_`/`sk-`/
  `xox*`, JWTs) — limpio. `TMDB_API_KEY` se lee solo de `process.env`
  (`src/lib/config.server.ts:44`), sin valor de reserva.
- Confirmé independientemente, buscando en `git log --all -p`, el token TMDB
  v4 (read access token) que quedó hardcodeado como reserva en un commit
  antiguo y sigue en el historial — coincide con lo que ya documentaban
  `docs/SEGURIDAD.md` y `docs/ARQUITECTURA.md`. No lo pego aquí ni en ningún
  otro sitio: el repo es público y el valor ya está ahí para quien busque,
  pero no hace falta repetirlo.
  - No lo probé contra la API real de TMDB — no hacía falta: había que darlo
    por comprometido de todas formas por estar en un repo público, sin
    importar si seguía respondiendo.
- Los JWT que aparecen en `src/lib/logo-index.json` son URLs firmadas de un
  CDN de imágenes de logos de canales, no credenciales de la app — descarté el
  falso positivo decodificando el payload.
- `CLAVE_VIMEUS` en `catalog/providers.ts` sigue siendo pública a propósito
  (riesgo aceptado #5 de `SEGURIDAD.md`) — no es un hallazgo nuevo.
- **El usuario ya había rotado el token de TMDB por su cuenta** (regenerado en
  themoviedb.org, cargado en Vercel como `TMDB_API_KEY`) antes de que yo
  terminara la auditoría. Actualicé el aviso 🚨 de `docs/ARQUITECTURA.md` y el
  punto de `docs/SEGURIDAD.md` a ✅ resuelto con la fecha.
- CSP: ya estaba implementada en `next.config.ts` (cabeceras generales +
  `CABECERAS_API` cerrada del todo en `/api/*`), con las omisiones
  documentadas y justificadas. No hice cambios — no encontré nada que faltara
  dado el resto de la arquitectura (dominios de canales/proveedores rotan sin
  aviso, `cacheComponents` incompatible con nonce).

---

## Lo siguiente

- Si este rol se formaliza, falta su definición en `.claude/agents/` y su
  entrada en `docs/EQUIPO.md`.
- Nadie ha verificado en vivo que el token viejo de TMDB ya no responde
  (paso que sugería el propio `docs/ARQUITECTURA.md`). No es urgente: el
  nuevo token ya está activo en Vercel y es lo único que importa para que la
  app funcione.
