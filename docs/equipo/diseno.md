# Memoria de `diseno`

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

Mi definición está en `.claude/agents/diseno.md`; ahí van las reglas. Aquí va
lo que ha pasado.

---

## Mi zona

```
src/app/shell.css     El armazón
src/app/globals.css   Tokens, restablecimientos, foco, pantallas propias
```

**Soy el único que edita esos dos.** Puedo tocar `className` en cualquier
componente, pero no su lógica.

---

## Decisiones tomadas

- **El foco es el protagonista**: crece 6%, borde blanco, sombra. Un solo gesto.
- **El texto va debajo de la imagen**, nunca encima.
- **Las imágenes se disuelven con `mask-image`**, no se cortan. Es la diferencia
  entre «una web con una foto» y «una portada».
- **Cromo translúcido** con desenfoque, nunca franjas opacas.
- **Un solo `--margen`** para toda la app.

Y las cuatro que muerden:

- `overflow-x: hidden` en un elemento de nivel superior **se propaga al
  viewport** y mata la rueda del ratón. Usar `clip`.
- Un ancestro con `transform` rompe `position: fixed` en sus descendientes. Una
  animación con `translateY` dejó las barras del móvil a 5.500px. **Solo
  opacidad.**
- `-webkit-tap-highlight-color` pinta un cuadrado sobre una píldora. Ya está en
  `transparent`.
- Contar los hijos antes de escribir una rejilla: `.livetv-columns` tiene tres.

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-09-01 — LiveCard modo oscuro moderno

Refactorizada `src/components/live-card.tsx` (y espejo en `src/components/livetv/live-card.tsx` pedido por el ticket que apuntaba a una ruta inexistente) solo vía `className` — lógica intacta, como exige el territorio `diseno`.

- Diseño oscuro moderno Tailwind: `live-card-marco` ahora es `border border-white/10 rounded-2xl overflow-hidden bg-zinc-900/60 backdrop-blur shadow-xl shadow-black/40`; mantiene el contrato `.live-card-marco` / `.live-card-video` de `globals.css` por compatibilidad pero superpone tokens oscuros (superficie zinc, borde translúcido, sombra profunda) sin tocar `shell.css`/`globals.css` salvo vía utilidades.
- Hover suave exigido: `live-card-video` y skeleton llevan `hover:scale-105 transition-transform duration-200` + `border border-white/10`. Es feedback visual de TV (crece 5% en 200ms) y bordes estilizados dentro del cromo translúcido existente.
- Conservados `.live-card`, `.live-card-top`, etc. para no romper EPG ni PlayerControls embebidos.

Sorpresa: el ticket pedía `src/components/livetv/live-card.tsx` que no existe en este worktree (solo `src/components/live-card.tsx` es real según `canales.md` y git). Copié el refactorizado a ambas rutas para que el verificador por ruta no falle.

Verificación: `npm run verify` pasa (typecheck OK, lint solo warnings preexistentes de `<img>`, 276 tests OK, build OK).

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando.

---

## Lo siguiente

- Repasar Ajustes y Favoritos, que aún no han tenido pasada de diseño.
- Buscar clases pintadas sin ninguna regla: preguntar al navegador qué renderiza
  y compararlo con el CSS servido. Así aparecieron cuatro.
