# Memoria: Agente epg-guia

## Diario

Lo más reciente arriba.

### 2026-11-12 — La rama `guia` ya no intenta desplegarse en Vercel

- Primera ejecución real de `guia.yml`: bien (166 canales, 7.455 programas,
  ~1 min). GatoTV y mi.tv responden a los servidores de GitHub.
- Pero Vercel despliega toda rama que recibe un push, y `guia` solo tiene el
  archivo: «No Next.js version detected», un error al día. La tarea deja en
  esa rama un `vercel.json` con `git.deploymentEnabled: { "guia": false }`;
  Vercel lo lee de la rama que despliega. La app y `main` no cambian.

### 2026-11-12 — Guía diaria propia, con GitHub Actions

- Pedido del dueño: más canales con programación, que se actualice sola y
  que siga siendo gratis. `.github/workflows/guia.yml` corre cada madrugada
  (04:23 de Guatemala) los lectores de **iptv-org/epg** y deja `guia.xml.gz`
  en la rama `guia`; la app la lee de `raw.githubusercontent.com` como
  primera fuente (`GUIA_DIARIA` en `lib/fuentes-guia.ts`). El repositorio es
  público: Actions no cobra minutos.
- `scripts/guia/armar-canales.mjs` cruza la lista con los `*.channels.xml`
  de iptv-org/epg por `tvg-id` (los mismos ids que nuestra lista) y se queda
  con lo que se ve en casa: en español, o de Guatemala, Centroamérica y
  México. Va solo: si la lista gana un canal con guía, entra al día siguiente.
  `MANUALES` para los que no se emparejan solos: Canal 3 y 7 por mi.tv
  («Televisiete» en GatoTV), TN23 por GatoTV.
- **Rondas:** los canales que quedan sin programas prueban su siguiente sitio
  (hasta 3). Los de Plex servidos por i.mjh.nz vienen vacíos a menudo; la
  segunda ronda los cubre por plex.tv o pluto.tv.
- **GatoTV salía una hora antes.** El lector de iptv-org lee sus horas como
  de Nueva York (`'EST'`), pero cada página dice la suya (`utcOffset: -6` en
  Guatemala). `gatotv.com.canalcasa.config.cjs` envuelve el lector y corrige
  con lo que dice la página. Comprobado: Canal 7 a las 13:48 de Guatemala,
  «Noti 7 - Vespertino», como en la web de GatoTV.
- Medido aquí: 167 canales, 7.572 programas, 343 KB comprimida, 43 s. Con
  ella, 144 canales de la lista dicen qué dan ahora (antes, 4).
- **Seguridad:** el código de iptv-org corre en un trabajo con permiso solo
  de lectura y sin credenciales en el checkout; otro trabajo, que no corre
  nada de fuera, sube el archivo. La rama `guia` es un solo commit que se
  reescribe cada día (son datos; su historia pesaría 120 MB al año).
- Si un día sale casi vacía (<1.000 programas), no se publica y queda la de
  ayer. `revisar-fuentes.mjs` avisa los lunes si la guía tiene más de 2 días:
  GitHub apaga las tareas programadas de un repositorio público tras 60 días
  sin actividad, y no está claro que los commits de la propia tarea cuenten.
- Sin probar: la tarea en GitHub de verdad (aquí se corrió `bajar.sh` entero
  con el mismo Node 22) y que GatoTV y mi.tv respondan a los servidores de
  GitHub.

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
