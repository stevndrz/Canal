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

### 2026-09-02 — Primera instalación en un televisor real

No es un viewport simulado: el APK de Android TV (workflow run
[`33533429087`](https://github.com/stevndrz/Canal/actions/runs/33533429087),
job `compilar`, artifact `canalcasa-androidtv` → `app-debug.apk`, 2.1 MB) se
instaló y se probó en un televisor físico con modo desarrollador activado.

- **ADB por WiFi no llegó.** La PC cuelga del router principal
  (`192.168.1.x`) y la TV de un nodo mesh Nexxt (`192.168.5.x`): dos subredes
  distintas porque el mesh está en modo Router (NAT propio), no en modo
  Puente/AP. `adb connect` daba *Connection timed out* siempre — no es un
  fallo de la app ni de la TV, es la topología de red. Queda pendiente si se
  quiere depurar por WiFi: pasar el mesh a modo Puente.
- **Sideload manual por USB, sí funcionó.** Memoria formateada en **FAT32**
  (NTFS no lo leía bien) con el `.apk` en la raíz, instalado desde el gestor
  de archivos de la TV con «orígenes desconocidos» permitido.
- **La app instala y corre.** Pero se ve y se siente como una página dentro
  de un marco, no como una app de TV: el hallazgo concreto es la barra de
  controles de reproducción (anterior/reproducir/siguiente) — el vídeo queda
  diminuto y la barra de botones grandes domina la pantalla. Es un problema
  de `diseno` sobre `player-bar`/`player-btn` en `globals.css` y
  `player-controls.tsx`, no de que algo esté roto.

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando.

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
