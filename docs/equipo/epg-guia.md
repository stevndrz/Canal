# Memoria: Agente epg-guia

## Diario

Lo más reciente arriba.

### 2026-11-12 — Guía interactiva en pantalla completa, como la del cable

- Pedido del dueño (con una foto de una guía de cable): en pantalla completa
  la «Guía» era una tira de logos y **cada flecha cambiaba de canal**. Ahora
  `player/guia-interactiva.tsx`: canales en filas, horas en columnas (2 h en
  pantalla ancha, 1 h en el teléfono), la raya roja del ahora y, abajo, el
  detalle (título, horario, «Quedan 1 h 9 min», barra de avance).
- **Recorrer no sintoniza.** ↑↓ fila, ←→ horario, RePág/AvPág y los botones
  de canal del mando saltan una página, Inicio vuelve a ahora, OK sintoniza y
  cierra, Atrás cierra sin salir de pantalla completa. Ratón: mover elige,
  clic sintoniza, la rueda baja filas. Teléfono: deslizar.
- El foco es estado (fila + **instante**), no `focus()`: al cambiar de fila se
  queda la hora y se elige el programa que la contiene, como en el cable.
  Cuentas en `lib/guia-interactiva.ts`, con pruebas.
- Solo se pintan las filas de la ventana y solo se pide `/api/guia` de esas
  más 6 por arriba y por abajo, con 180 ms de espera para que mantener ↓ no
  lance una petición por fila.
- Se cierra sola a los 30 s sin tocar nada (antes 5 s: no da para leer).
- Dos fallos encontrados probando: el ratón quieto robaba el foco cuando las
  filas pasaban por debajo (`onMouseEnter` → `onMouseMove`), y OK sintonizaba
  pero el aviso de actividad volvía a abrir la guía.
- **iPhone no la ve:** allí «Pantalla completa» abre el reproductor de Apple.
  Probada en Chromium a 1920, 1280, Pixel vertical y horizontal; e2e
  `guia-pantalla-completa.spec.ts`. Sin probar en una tele de verdad.
- Se borró `player/guia-canales.tsx` (la tira) y su CSS.

