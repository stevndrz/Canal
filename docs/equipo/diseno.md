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

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando. El estado de partida está en `PLAN-ARVIO.md`
(fases 0 a 6.5) y en `SALUD-CODIGO.md`.

---

## Lo siguiente

- Repasar Ajustes y Favoritos, que aún no han tenido pasada de diseño.
- Buscar clases pintadas sin ninguna regla: preguntar al navegador qué renderiza
  y compararlo con el CSS servido. Así aparecieron cuatro.
