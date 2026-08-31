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
- ~~La parrilla de la guía EPG sigue aplazada~~ — **hecha**. Conmutador
  Lista/Parrilla en la cabecera de Canales, con la lista por defecto porque es
  la que funciona siempre (la parrilla necesita `EPG_URL`, y el caso por defecto
  de esta app es no tenerla).

  Lo que hubo que resolver, por si toca tocarla: la programación de varias horas
  **no puede viajar con la lista** —`Channel` no puede engordar, cada campo va
  7.822 veces—, así que se pide por ventana de canales a `/api/guia`, que
  responde en tuplas. Las cuentas están en `lib/parrilla.ts`, probadas aparte;
  lo que más cuesta de una parrilla no es la rejilla sino los tres casos de
  borde: lo que empezó antes de la franja, lo que sigue después, y los huecos
  de guía, que hay que dibujar o dos programas seguidos parecen uno.

  En `parrilla-epg.tsx` **no hay ni un `gap`**, a propósito: en webOS y Tizen
  vale cero. Separación con margen y borde.
