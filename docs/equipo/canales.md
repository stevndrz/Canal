# Memoria de `canales`

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

Mi definición está en `.claude/agents/canales.md`; ahí van las reglas. Aquí va
lo que ha pasado.

---

## Mi zona

```
src/components/livetv/          La pantalla de Canales y sus filas
src/components/live-card.tsx    El reproductor incrustado de Inicio
src/components/stream-player.tsx · fullscreen-player.tsx · player/
src/lib/m3u.ts · epg.ts · channels.ts · categories.ts
src/lib/reproduccion/ · describir-canal.ts
```

**No toco:** `peliculas/`, `lib/catalog/`, `components/catalog/`, ni el CSS.

---

## Decisiones tomadas

- **Cada campo de `Channel` viaja 7.822 veces.** Si se puede calcular en el
  cliente, se calcula ahí. Si es constante, no se manda. Si puede faltar, se
  omite la clave — React serializa `undefined` como el texto `"$undefined"`, y
  eran 700 KB de decir que no hay nada.
- **hls.js y mpegts.js nunca a nivel de módulo.** Tocan `self` y tumban la
  página con un 500. Dos defensas: `serverExternalPackages` y
  `next/dynamic({ ssr: false })`.
- **Logos con `<img>`**, no `next/image`: vienen de cientos de dominios.
- **En iPhone la pantalla completa no cambia de vista.** El cambio desmonta el
  `<video>` y iOS cancela la pantalla completa. Costó tres intentos entenderlo.
- **Elegir un canal no salta a pantalla completa**: sube arriba y lo pone en
  emisión ahí. Decisión de producto.

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando. El estado de partida está en `PLAN-ARVIO.md`
(fases 0 a 6.5) y en `SALUD-CODIGO.md`.

---

## Lo siguiente

- `stream-player.tsx` (8,64) y `fullscreen-player.tsx` (8,29) siguen marcando
  *Large Method*. Coordinar con `calidad` antes de tocarlos.
- La parrilla de la guía EPG sigue aplazada; hoy solo hay vista de lista.
