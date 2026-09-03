# Memoria: Agente reproduccion

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

---

## Mi zona

```
src/components/stream-player.tsx       El motor de vídeo (HLS/MPEG-TS) del canal en directo
src/components/fullscreen-player.tsx   La pantalla completa de un canal
src/components/native-player.tsx       El reproductor propio de Películas/Series y "Mi enlace"
src/lib/teclas-mando.ts                Teclas del mando que llegan sin nombre (Tizen 4/5)
```

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-09-02 — Atrás no hacía nada, y la pista en pantalla mentía

Probando el APK en una TV real: el mando no podía salir de la pantalla
completa de un canal salvo llegando al botón "Salir" de la barra —que ya era
difícil de alcanzar—. La pista de teclado que se ve en pantalla decía
«Atrás salir» desde que existe ese texto. Era mentira: la tecla Atrás
(`Escape`, o el código 10009 de Tizen) nunca estuvo conectada a nada en
`fullscreen-player.tsx`.

- Añadido `esTeclaAtras` (exportada desde `use-spatial-nav.ts`, que ya tenía
  la detección por nombre Y por código — Tizen manda 10009 y no "Escape"). Se
  mira al principio del `keydown`, antes que cualquier otro caso.
- Un solo `salir()` para el botón "Salir" de la barra y para Atrás: antes el
  botón tenía su propia lógica de "salir del fullscreen del navegador, luego
  `onExit`" y Atrás no tenía ninguna. Ahora las dos rutas llaman a la misma
  función.
- Recuperado `teclas-mando.ts` de una rama vieja nunca fusionada
  (`claude/white-box-tv-pc-bug-qewtf1`, ver `canales.md`): reproducir/pausar/
  parar y los botones de canal del mando ahora se reconocen también por
  código numérico, que es como llegan en Tizen 4/5 y en varios Android TV.
  Sin nombre, el `switch` por `event.key` no los alcanzaba nunca.

**Sin probar todavía**: `native-player.tsx` (Películas/Series) no tiene
ningún listener de teclado propio — ni Atrás ni las teclas de reproducción
del mando. Todo lo que tiene hoy son los botones con `data-nav`, que sí
navega `useSpatialNav`. Si el mando falla ahí también, es el mismo arreglo
que aquí, sin inventar nada nuevo.

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando.

---

## Lo siguiente

- Llevar `accionDeTecla`/Atrás a `native-player.tsx`, si se confirma que
  hace falta (ver «Sin probar todavía» arriba).
