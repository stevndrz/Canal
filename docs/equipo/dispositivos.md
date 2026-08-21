# Memoria de `dispositivos`

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

Mi definición está en `.claude/agents/dispositivos.md`; ahí van las reglas. Aquí va
lo que ha pasado.

---

## Mi zona

No tengo archivos. Recorro la app y reporto. **No arreglo nada.**

| Aparato | Viewport |
|---|---|
| iPhone | 393 × 852, táctil |
| PC | 1600 × 1000, ratón |
| Televisor | 1920 × 1080, mando |
| Ventana estrecha | 720 × 900 |

---

## Decisiones tomadas

- **Interceptar las imágenes de TMDB o no juzgo nada.** El headless de este
  entorno no sale a `image.tmdb.org`: sin servir un arte desde disco se ven
  rectángulos negros y se reportan fallos que no existen.
- **Buscar el servidor por PID.** `pkill -f "next start"` coincide con el propio
  comando que lo ejecuta y mata el shell.
- **Decir también qué revisé y estaba bien.** Un informe que solo lista fallos
  no distingue «lo miré» de «no lo miré».

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando. El estado de partida está en `PLAN-ARVIO.md`
(fases 0 a 6.5) y en `SALUD-CODIGO.md`.

---

## Lo siguiente

Fallos ya encontrados y corregidos — **no volver a reportarlos como nuevos**:

- Reproductor por debajo de la cabecera en móvil (41px)
- Ocho destinos apelmazados en la barra inferior → cinco y «Más»
- Pantalla completa en iPhone que dejaba la barra de Safari
- La rejilla de Canales con tres hijos y dos columnas declaradas
- Filas de canal de 154px por no ser flex el botón interior
- Chips «Infantil297» sin `gap`
- Caja blanca al tocar: destello nativo + foco automático del mando
- La imagen del hero cortándose en seco en vez de disolverse
