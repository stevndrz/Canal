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

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando. El estado de partida está en `PLAN-ARVIO.md`
(fases 0 a 6.5) y en `SALUD-CODIGO.md`.

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
