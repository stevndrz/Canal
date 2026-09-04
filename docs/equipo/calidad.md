# Memoria de `calidad`

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

Mi definición está en `.claude/agents/calidad.md`; ahí van las reglas. Aquí va
lo que ha pasado.

---

## Mi zona

Todo el repositorio, **solo con cambios que no alteran comportamiento**.
Si un refactor exige cambiar lo que la app hace, va a su dueño.

---

## Decisiones tomadas

- **No estimar hotspots: pedir la lista real del panel.** Una estimación casera
  por tamaño × frecuencia apostó por `title-detail.tsx` (466 líneas). Era
  `epg.ts`, con 157. El modelo no premia que un archivo sea corto: lo que hunde
  la nota es el *Bumpy Road*, varias secciones de lógica anidada seguidas.
- **Un refactor por commit**, y `npm run verify` después de cada extracción.
- **Capturar qué pinta una pantalla antes de tocarla** y comprobar que después
  sale lo mismo.
- **jsdom no**: los componentes se verifican con Playwright contra la app real.
  Ninguno de los fallos reales de este proyecto lo habría cazado jsdom.
- **`no-unused-vars` en error.** El preajuste de Next no la trae; encontró diez
  símbolos muertos el primer día.
- **El CI compila sin secretos** a propósito: la app arranca recién clonada.

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-09-04 — Calidad de vivo: ABR afinado, multi-fuente, sonda y selector

Excepción a mi regla: esto SÍ cambia comportamiento, a petición directa del
usuario (quería las 5 mejoras de calidad de vivo implementadas). Toca la zona
de `canales` y `reproduccion` — ver sus memorias antes del PR.

- `motor.ts`: reintentos y búfer para vivo inestable + `resolverCalidad`,
  `nivelMaxParaCalidad`, `fijarCalidad` (cambio en caliente sin reiniciar),
  `precargarCanal`. Todo probado en `motor.test.ts`.
- `stream-player.tsx`: fallback a `streamUrlBackup` antes de «Sin señal»,
  stalls/TTFF/dropped reales, calidad de arranque por `ref` para no reiniciar.
- `m3u.ts` fusiona duplicados en `streamUrlBackup`; viaja en el paquete sin
  coste para el canal normal (quinto hueco polimorfo).
- Nuevo `GET /api/salud?url=` con puntuación 0–100 (`sonda-salud.ts`).
- Ajustes: «Calidad máxima» → selector Auto/480p/720p/1080p, con migración del
  booleano viejo.
- `npm run verify` en verde: typecheck, lint 0 errores, 300 tests, build.
- Deuda que dejo: `stream-player.tsx` creció (~615 líneas) y ya marcaba *Large
  Method* — el siguiente refactor debería partirlo.

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando.

---

## Lo siguiente

Por orden de retorno:

1. `stream-player.tsx` (8,64) y `fullscreen-player.tsx` (8,29): los dos marcan
   *Large Method*. Sacar controles y Cast a sus piezas.
2. Extraer los hooks de `dashboard.tsx` — 27 commits, el archivo que más se toca.
3. Unificar `claseDeEmision` y `claseDeUrl`: hacen lo mismo en dos sitios.
4. `m3u.ts` (8,75): separar descargar de interpretar.
5. Activar la integración de PRs de CodeScene, para que esto sea continuo.

⚠️ Hay un token de TMDB de solo lectura en el historial de Git. No sale al
navegador, pero si el repositorio deja de ser privado hay que rotarlo.
