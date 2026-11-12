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

### 2026-11-12 — La guía no tenía datos: fuentes nuevas y emparejar por país

- **El problema no era la pantalla, era la fuente.** La única guía era la
  `x-tvg-url` de la lista (`worker-9dd4.onrender.com/guide.xml.gz`): 2 canales
  de 4.922 (Al Jazeera English y ANT1), 99 programas, del día anterior.
- `lib/fuentes-guia.ts`: se juntan la de la lista y las de respaldo
  (`GUIAS_DE_RESPALDO`). Hoy, open-epg Guatemala: 98 canales como se ven aquí,
  unos dos días por delante, 240 KB comprimida, contesta en ~1,3 s. `EPG_URL`
  admite varias separadas por comas y, si se pone, manda sola; `no` apaga la
  guía (lo usa el e2e para no salir a internet).
- `epg.ts`: `fetchGuias` las pide en paralelo (cada una con su caché y su tope
  de 5 s; la que falla no aporta). `combinarGuias` no mezcla programas de dos
  fuentes en un mismo canal. Las búsquedas prueban **todas** las candidatas en
  orden y se quedan con la primera que tenga algo del momento pedido: si no, la
  guía de la lista, con datos viejos de un canal, tapaba la buena.
- **Emparejar por país.** open-epg usa ids como «Canal 7 - Televisiete.gt» que
  no se parecen al `tvg-id` (`Canal7.gt@SD`). `idPorPais` guarda el nombre
  limpio con su país (`gt|canal7`) y solo se usa si el canal de la lista es de
  ese país. Medido con las guías y la lista reales: sin país, 12 parejas, 9 de
  ellas mal (NTV de Albania, Bangladés y Brasil con el NTV de Guatemala…); con
  país, solo las 3 buenas.
- **Resultado con datos reales:** antes, 1 canal con guía; ahora, Canal 3,
  Canal 7, Guatevisión y Al Jazeera.
- **Probadas y descartadas:** epgshare01 México (175 canales pero ids como
  «Canal.2.de.México.(Canal.Las.Estrellas.-.XEW).mx»: 1 pareja), Pluto TV de
  i.mjh.nz (ids internos de Pluto, ninguna pareja). La lista pública no trae
  el cable (ESPN, Discovery…) que sí está en open-epg.
- **Sin guía en ningún sitio: TN23.** La fila sigue diciendo solo el canal; no
  se inventa nada.
