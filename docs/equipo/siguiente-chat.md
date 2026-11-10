# Prompt para el siguiente chat (modo plan)

Escrito el 2026-11-10, al cerrar el ciclo de los PR #94–#103. Cópialo entero
en un chat nuevo, en modo plan. Debajo del prompt van las directrices de
diseño de la sala y las sugerencias a las que se refiere.

---

Proyecto: CanalCasa (repo stevndrz/Canal, Next.js 16.4 + React 19, desplegado en Vercel). Antes de escribir código de Next, lee AGENTS.md y node_modules/next/dist/docs/. Soy el dueño, vivo en Guatemala, uso Windows 11 con GPU NVIDIA, un iPhone y una tele Samsung de 2021 o más nueva. Explícame en simple qué haces y por qué, dame tu opinión y, si hay una forma mejor de lo que pido, dímela.

Estás en modo plan: no toques código. Lee primero, en este orden: docs/PELICULAS-JUNTOS.md, docs/VIMEUS-JUNTOS.md, docs/ARQUITECTURA.md, docs/equipo/catalogo.md, docs/equipo/diseno.md, docs/equipo/calidad.md y docs/equipo/dispositivos.md. Después lee el resto de este archivo (docs/equipo/siguiente-chat.md): trae las directrices de diseño de la sala y las 15 sugerencias con su esfuerzo. Comprueba en GitHub qué está fusionado (los PR #94 a #103 ya lo están).

Decisiones ya tomadas (no las reabras): seguimos con Next; las películas las subo yo desde mi PC con el panel y «Sincronizar sola»; nada de convertir en la nube ni en GitHub Actions; sin avisos al teléfono.

Lo que quiero que planifiques

1. «Descargar desde un enlace» en el panel del PC (scripts/peliculas/sincronizar/). Pego un enlace directo a un .mkv o .mp4 y el PC lo baja a la carpeta de películas; el resto ya es automático. En Node, con pruebas contra un servidor HTTP local. Reutiliza lib/agregar.mjs (.part y renombrar, no sobrescribir, comprobar espacio) y el avance por /api/eventos de panel.mjs. Solo enlaces directos http(s): si responde una página HTML, que lo diga claro. No resolver páginas de descarga ni nada de Vimeus.

2. Rediseñar la pestaña Mi enlace (la sala), que sigue viéndose fea en mi iPhone, sobre todo cuando no hay películas: media pantalla vacía arriba, un «Elijan una película» enorme sin nada que elegir, tres botones iguales apilados y el aviso de «Todavía no hay películas» cortado por la barra de abajo. Quiero «una pantalla, un siguiente paso», con cinco estados: vacío, eligiendo, sala esperando, viendo y en pausa. Cada estado enseña solo lo que sirve y tiene un único botón principal. Reglas: el contenido empieza arriba; una sola escala de títulos; nada cortado por la barra inferior; esqueletos mientras carga; si hay sala recordada, el botón principal es «Volver a la sala». Enséñame capturas de antes y después en iPhone, PC y tele.

3. Ideas que me gustaron; dime cuáles caben y en qué orden:
   - El estado del PC visible en la app: el sincronizador escribe un estado.json en el bucket (última sincronización, espacio usado de 10 GB, qué convierte y su porcentaje) y la app lo enseña.
   - Invitar con enlace (hoja de compartir del teléfono, …/?sala=8047 entra directo) y con QR en la tele.
   - El teléfono como mando de la tele dentro de la sala.
   - Controles en la pantalla de bloqueo (Media Session) y que la pantalla no se apague (Wake Lock).
   - Chip «Sincronizados ✓ / Ajustando…».
   - Doble toque a los lados para ±10 s y girar el teléfono para pantalla completa.
   - Opcionales: reacciones con emoji, cola «Después vemos…», color de avatar, bienvenida de tres pasos para quien entra por enlace.

4. Estabilidad y eficiencia. Dime qué haría falta, ordenado por valor frente a esfuerzo:
   - sincronizar-sola.cmd no encuentra Node cuando Windows no refrescó el PATH; el #101 lo arregló en sincronizar.cmd y panel.cmd con buscar-node.cmd, pero ese se quedó fuera.
   - Pruebas con el motor de Safari (proyecto WebKit en Playwright), para cazar fallos de iPhone.
   - Ver errores reales: los logs de Vercel duran 1 hora. Mandar «no arrancó», «se desincronizó» y cortes a los eventos de src/lib/telemetria.ts.
   - Cupo de peticiones propio para /api/pusher/auth, separado del de /api/buscar.
   - Que use-ver-juntos.ts use lib/ver-juntos/conexion.ts (hoy hay dos copias de la conexión) y partir native-player.tsx, que tiene más de 1.300 líneas.
   - Logos de canal más pequeños (pesan 1,6 MB en la portada): necesita mi sí porque usa un servicio externo.
   - Gestor de espacio de R2 en el panel: avisar de películas ya terminadas que ocupan sitio, sin borrar nunca solo.
   - partialPrefetching de Next, que avisa al compilar.
   - Subtítulos automáticos (OpenSubtitles + alass): solo si cabe. Dime la clave que haría falta (nombre, tipo y entornos).

Cómo quiero el plan
- Una tabla final con cada tarea: valor, esfuerzo, riesgo, el orden que propones y si es un PR propio.
- Hazme preguntas (AskUserQuestion) donde haya una decisión mía.
- Di qué quedaría sin probar y qué tengo que hacer yo (en el PC, en la tele, en el iPhone o en Vercel).

Reglas (obligatorias al ejecutar)
- NO añadir campos al tipo Channel.
- Pregunta antes de cualquier cosa que pueda borrar datos de la familia (favoritos, último canal, recientes, historial de la sala, películas en R2) o que cambie lo que ven todos.
- Mensajes nuevos de la sala: que las versiones anteriores de la app los ignoren sin romperse.
- Servidor de desarrollo: se para por PID (mira ps; nunca pkill -f next). Nada de npm run build con él encendido. Borra .next si cambian las rutas. En el contenedor, el fetch de Node no usa el proxy: NODE_USE_ENV_PROXY=1 npm run dev.
- CSS: solo backdrop-filter (sin -webkit-), colores solo de los tokens de src/app/shell.css, diffs pequeños. diseno es el dueño de shell.css y globals.css; dispositivos prueba en iPhone, PC y tele.
- Scripts de Windows en PowerShell 5.1: BOM UTF-8, $ErrorActionPreference = "Continue". Lo nuevo del PC va en Node, con pruebas.
- Antes de cada push: npm run typecheck && npm run lint && npm test; npm run build y npm run e2e antes del PR. Revisa la salida completa.
- Commits pequeños por tema, en español. Diarios en docs/equipo/.
- Prueba de verdad: npm run e2e (Playwright con varios aparatos y el Pusher simulado que comprueba la firma); rclone falso para el PC. Dime qué quedó sin probar.
- Una rama nueva desde main por tema y un PR por tema. No apiles PR uno encima de otro: si uno necesita a otro, espérame a que lo fusione o dímelo. Si main cambia y un PR choca, trae main con un commit de fusión (no reescribas historial).
- Variables nuevas: dime nombre, tipo y entornos; nunca me pidas el valor por el chat.
- No extraer el vídeo de Vimeus ni esquivar sus anuncios o protecciones.

---

## Parte A — Directrices para rediseñar Mi enlace (la sala)

**Principio: una pantalla, un siguiente paso.** La pantalla tiene cinco estados y cada uno enseña solo lo que sirve en ese momento, con un único botón principal.

| Estado | Qué se ve | Botón principal |
|---|---|---|
| **Vacío** (sin películas) | Qué es esto en una frase, los 3 pasos (deja la película en la carpeta → el PC la sube → aparece aquí) y **el estado real del PC** (ver idea 1). Nada de «Elijan una película». | «Cómo subir una película» |
| **Eligiendo** | El estante como tarjetas ricas: póster, duración, idiomas, barra de «iban por 47:10», etiqueta «Nueva». Arriba, si existe, una tarjeta grande «Seguir viendo juntos». | Tocar una tarjeta |
| **Sala, esperando** | Reproductor, quién está, y **Invitar** en grande (ver idea 2). | «Invitar» |
| **Viendo** | Solo el reproductor y una franja mínima de presencia. Todo lo demás se recoge. | — |
| **En pausa** | Quién pausó, por dónde van, y «Seguir». | «Seguir» |

**Reglas visuales**

- El contenido empieza arriba, bajo la cabecera. Nunca media pantalla vacía (hoy `.cine-portada` alinea abajo con `min-height` cuando no hay reproductor).
- Una sola escala de títulos. El título grande es el nombre de la película, no una instrucción.
- Un botón principal por pantalla; los demás, secundarios o de texto. «Crear sala», «Volver a la sala» y «Entrar con código» no pueden pesar lo mismo: si hay sala recordada, el principal es «Volver a la sala 8047».
- Nada queda cortado por la barra inferior: respetar `env(safe-area-inset-bottom)` y la altura de la barra.
- Esqueletos mientras carga el catálogo, en vez de pantalla en negro seguida de un salto.
- Colores solo de los tokens de `src/app/shell.css`; solo `backdrop-filter` sin prefijo; `diseno` es el dueño de `shell.css` y `globals.css`.

**Ideas innovadoras y útiles (por orden de valor)**

1. **El PC, visible desde el teléfono.** El sincronizador escribe un `estado.json` pequeño en el bucket (última sincronización, espacio usado de los 10 GB, qué está convirtiendo y su porcentaje, pendientes). La app lo lee como ya lee `catalogo.json`. En el estado vacío y en el estante: «Convirtiendo Buddy · 62 %», «Sincronizado hace 5 min», «7,2 de 10 GB». Sin servidor nuevo. Ya existe `lib/estado.mjs` y `lib/progreso.mjs` del panel para reutilizar.
2. **Invitar con enlace y con QR.** «Invitar» abre la hoja de compartir del teléfono (`navigator.share`) con un enlace `…/?sala=8047` que entra directo. En la tele, la sala enseña un QR: el teléfono lo escanea y entra. Se acaba dictar el código (y el error de escribirlo como nombre).
3. **El teléfono como mando de la tele.** Si en la sala hay una tele, el teléfono ofrece «Modo mando»: botones grandes de pausa, ±10 s y volver a empezar. Como todos mandan, es solo otra piel de la misma sala.
4. **Controles en la pantalla de bloqueo.** Media Session API: título, carátula y play/pausa en la pantalla de bloqueo y en los auriculares. Y Wake Lock para que la pantalla no se apague con la película en pausa dentro de la sala.
5. **Chip de sincronía.** «Sincronizados ✓» o «Ajustando…» junto a la presencia: quita la duda de «¿vamos igual?».
6. **Gestos del reproductor en el teléfono.** Doble toque a los lados para ±10 s; girar el teléfono entra en pantalla completa.
7. **Reacciones.** Cuatro emojis que flotan un segundo sobre el vídeo de todos (mensaje nuevo y efímero por la misma sala). Opcional: solo si no ensucia.
8. **«Después vemos…»** Una cola corta de la sala: la siguiente película queda elegida.
9. **Avatar con color.** Al elegir nombre, elegir también un color: los círculos se distinguen de un vistazo.
10. **Primera vez de una invitada.** Si entra por enlace, tres pantallas mínimas: tu nombre → ya estás dentro → «todos pueden pausar».

---

## Parte B — Sugerencias para todo el proyecto (15)

Ordenadas por valor frente a esfuerzo. Cada una, un PR propio desde `main`.

| # | Sugerencia | Qué gana | Esfuerzo | Riesgo |
|---|---|---|---|---|
| 1 | **Descargar desde un enlace** en el panel del PC (pedido) | Menos pasos manuales | 1 d | Bajo |
| 2 | **Rediseño de Mi enlace por estados** (Parte A, tabla y reglas) | Lo que el dueño ve feo hoy | 2 d | Medio |
| 3 | **Estado del PC en la app** (`estado.json` en R2) | Saber sin ir al PC si la película ya está | 1 d | Bajo |
| 4 | **Invitar con enlace y QR** | Entrar a la sala sin dictar código | 1 d | Bajo |
| 5 | **`sincronizar-sola.cmd` usa `buscar-node.cmd`** | Fallo pendiente: el doble clic no encuentra Node | 0,5 d | Bajo |
| 6 | **Pruebas con el motor de Safari** (proyecto WebKit en Playwright) | Cazar fallos de iPhone antes del iPhone | 1 d | Bajo |
| 7 | **Media Session + Wake Lock** | Controles en pantalla de bloqueo; pantalla que no se apaga | 0,5 d | Bajo |
| 8 | **Errores reales a la vista** | Hoy los logs duran 1 h; mandar «no arrancó», «se desincronizó» y cortes a los eventos de `src/lib/telemetria.ts` | 1 d | Bajo |
| 9 | **Cupo de peticiones separado para la sala** | Que `/api/buscar` nunca vuelva a bloquear `/api/pusher/auth` | 0,5 d | Bajo |
| 10 | **Unificar la conexión de la sala** (`use-ver-juntos.ts` → `lib/ver-juntos/conexion.ts`) y partir `native-player.tsx` (1.335 líneas) | Menos sitios donde romper; ya hay 18 pruebas de red | 2–3 d | Medio |
| 11 | **Logos de canal más pequeños** | 1,6 MB menos en la portada. Necesita el sí del dueño (servicio externo) | 1 d | Medio |
| 12 | **Gestor de espacio de R2** | El panel avisa «3 películas terminadas ocupan 6 GB» usando el historial; nunca borra solo | 1 d | Bajo |
| 13 | **Teléfono como mando de la tele** | Resuelve también la sincronía suave en la tele | 1,5 d | Medio |
| 14 | **Subtítulos automáticos** (OpenSubtitles + alass), pendiente del ciclo anterior | Necesita `OPENSUBTITLES_API_KEY`, secreta, solo en el PC | 2 d | Medio |
| 15 | **`partialPrefetching` de Next** | Next avisa al compilar; será obligatorio. Pide revisar los enlaces | 1 d | Medio |

**Lo que no es código y sigue pendiente (del dueño):** Secret scanning, Push protection y alertas de Dependabot en GitHub; límite de peticiones en el Firewall de Vercel; rotar la llave de R2 si se usó el comando antiguo.

### Detalle de la 1: «Descargar desde un enlace»

- Archivo nuevo `scripts/peliculas/sincronizar/lib/descargar.mjs`, con pruebas contra un servidor HTTP local.
- Reutiliza el patrón de `lib/agregar.mjs`: escribe `nombre.mkv.part` y renombra al final, nunca sobrescribe (« (2)»), comprueba espacio con `statfs`.
- Solo `http(s)`. Rechaza con mensaje claro si la respuesta es una página HTML (enlace con página intermedia) o no es un vídeo de `VIDEOS` (`lib/biblioteca.mjs`).
- Nombre del archivo desde `Content-Disposition` o la URL; reanuda con `Range` si se corta.
- En `panel.mjs`: una acción más junto a `agregar()`, con el avance por `/api/eventos` que ya existe; casilla en `panel/index.html`.
- No sigue enlaces de Vimeus ni resuelve páginas de descarga: solo enlaces directos.

---

## Archivos clave para quien ejecute

- Sala: `src/components/views/fuente-view.tsx`, `src/components/views/sala-cine.tsx`, `src/components/views/entrar-sala.tsx`, `src/hooks/use-ver-juntos.ts`, `src/lib/ver-juntos/` (`sala.ts`, `recordar.ts`, `historial.ts`, `conexion.ts`, `reloj.ts`).
- Estilos de la sala: familia `.cine-*` en `src/app/globals.css`; reproductor: familia `.atv-*`.
- Reproductor: `src/components/native-player.tsx`.
- PC: `scripts/peliculas/sincronizar/` (`panel.mjs`, `panel/index.html`, `lib/agregar.mjs`, `lib/estado.mjs`, `lib/progreso.mjs`, `lib/entorno.mjs`, `lib/automatico.mjs`, `tarea.mjs`), `scripts/peliculas/buscar-node.cmd`, `scripts/peliculas/sincronizar-sola.cmd`.
- Pruebas: `e2e/` (`servidor.mjs`, `pusher-falso.ts`, `aparatos.ts`, `ver-juntos.spec.ts`, `nuestras-peliculas.spec.ts`, `sincronia-suave.spec.ts`), `scripts/peliculas/sincronizar/pruebas/rclone-falso.mjs`.
- Telemetría: `src/lib/telemetria.ts`. Freno de peticiones: `src/lib/limite-peticiones.ts`.

## Verificación (cuando se ejecute)

- `npm run typecheck && npm run lint && npm test && npm run build`.
- `npm run e2e` (18 pruebas hoy): debe seguir en verde y crecer con cada función de sala.
- Para el rediseño: capturas de los cinco estados en iPhone (393×852), PC (1600×1000) y tele (1920×1080), y una prueba que compruebe que nada queda bajo la barra inferior ni fuera del ancho.
- Para «Descargar desde un enlace»: prueba con servidor HTTP local (archivo bueno, página HTML, corte a la mitad y reanudación, nombre repetido, disco sin espacio).
- Sin probar posible desde el contenedor: iPhone real, la tele, Windows y Pusher de verdad. Hay que decirlo en cada PR.
