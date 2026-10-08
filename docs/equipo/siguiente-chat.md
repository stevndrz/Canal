# Prompt para el siguiente chat (preparado el 2026-10-08)

Copiar desde aquí:

---

Proyecto: CanalCasa (repo stevndrz/canal, Next.js 16.4 — lee AGENTS.md y
`node_modules/next/dist/docs/` antes de escribir código de Next). Soy el
dueño; vivo en Guatemala. Figma está conectado: el diseño de referencia es
https://www.figma.com/make/kVYi9ATVcg4tgavbxgL0HX/Static-Search-Page (se lee
con `get_design_context`, nodeId `0:1`).

## Estado al empezar
- En `main`: Canal 3/7/TN23 con fuentes oficiales (`lib/fuentes-oficiales.ts`),
  revisión semanal de fuentes y de la lista del gist
  (`.github/workflows/revisar-fuentes.yml`), Películas/Series/Anime separados
  (`lib/catalog/secciones.ts`), Vidzee 2.º servidor, sin sandbox, Next 16.4.
- **PR #72 abierto** (rama `diseno/ficha-premium`): ficha estilo Apple TV,
  barra sin cápsula, Inter en toda la app, título de la ficha por largo,
  Buscar según el Figma, Pokébola en Anime, secciones por tema en Canales, y
  limpieza (fuera `/api/proxy/*` y la maquinaria de sandbox). Revisarlo en la
  vista previa de Vercel y fusionarlo antes de seguir.
- Diarios al día en `docs/equipo/{canales,catalogo,diseno}.md`.

## Prioridades (en este orden)
1. **Seguridad — `/api/salud` es un proxy abierto**: descarga cualquier
   `http(s)://` que le pasen (solo hay límite de peticiones). Limitarlo a las
   URLs que están en la lista de canales (o en `fuentes-oficiales.ts`) y
   rechazar IPs privadas/locales. Revisar igual `/api/stream` y `/api/buscar`.
2. **Seguridad — CSP de los marcos**: hoy `frame-src` no tiene lista blanca.
   Los servidores de cine son pocos y fijos (vimeus.com, player.vidzee.wtf,
   multiembed.mov, vidrock.net + el propio de entorno): ponerlos en lista
   blanca. Coordinar con el agente `config-seguridad`.
3. **Rendimiento**: medir con Speed Insights de Vercel y Lighthouse en
   teléfono y en una tele (Tizen/webOS). Candidatos: JetBrains Mono solo se
   usa en el reproductor (¿quitarla o cargarla solo ahí?); las dos
   advertencias `<img>` de `media-card.tsx` (decidir `next/image` o dejarlas
   por la tele, pero con `loading="lazy"` y tamaños); revisar el peso del
   paquete de canales y el JS de la portada.
4. **Diseño**: llevar el lenguaje del Figma (cristal fino, Inter, botón
   blanco, píldoras finas) a Inicio, a las portadas de Películas/Series/Anime
   (héroe, rieles, tarjetas con realce al pasar) y a Canales. Hay un
   mini-reproductor flotante que en PC se monta sobre la barra superior al
   hacer scroll en Canales: corregirlo.
5. **Anime con datos de verdad (solo metadatos, legal)**: integrar
   **Jikan** (`api.jikan.moe/v4`, API no oficial de MyAnimeList, sin clave,
   ~3 peticiones/s y 60/min: cachear en el servidor con `cacheLife`) o
   **AniList** (GraphQL oficial y gratis) para la sección Anime: «En emisión
   esta temporada», «Horario de estrenos de la semana», ranking, y «Dónde
   verlo» con los enlaces oficiales que trae cada ficha (Crunchyroll,
   Netflix…). Comparar las dos y elegir una; pedirlas siempre desde el
   servidor, nunca desde la tele. NO integrar fuentes de vídeo de proyectos
   como ErickLimaS/anime-website (usan Consumet/Aniwatch, que sacan los
   episodios de sitios sin licencia).
6. **Mantenimiento**: cerrar o actualizar los PR de dependabot (el de
   `produccion-menores` quedó viejo: sube Next a 16.3.6 y ya estamos en 16.4);
   quitar `NEXT_PUBLIC_SITIO_URL` de Vercel si existe (ya no se usa); borrar
   ramas viejas ya fusionadas.

## Reglas (obligatorias)
- NO añadir campos al tipo `Channel`.
- Si algo puede borrar datos de la familia (favoritos, último canal, recientes)
  o cambia lo que ven todos, pregunta antes.
- Servidor de desarrollo: pararlo por PID (`ps -eo pid,args | grep next`);
  nunca `pkill -f next`. No correr `npm run build` con él encendido. Borrar
  `.next` si cambian rutas (si no, `tsc` falla con tipos viejos).
- CSS: solo `backdrop-filter` (sin `-webkit-`); colores solo de los tokens de
  `src/app/shell.css`; diffs pequeños.
- Antes de cada push: `npm run typecheck && npm run lint && npm test`;
  `npm run build` antes del PR. Revisa la salida completa.
- Commits pequeños por tema, en español. Diarios en `docs/equipo/`.
- En el contenedor no hay `TMDB_API_KEY`: para ver una ficha, meter un título
  temporal en `src/data/catalog.json` (y restaurarlo) e inyectar el fondo con
  Playwright. Chromium no trae H.264: «se pide el .m3u8 y responde 200» es la
  prueba válida, no «se ve».
- Explícame en simple qué hiciste y por qué, y dame tu opinión.

---

## Notas para quien lo retome
- La vista previa de Vercel está protegida. Si `list_teams` de Vercel sale
  vacío, la conexión de Claude no tiene el equipo
  «michael-steven-duarte-gonzalezs-projects»: pedir al dueño que la reconecte
  desde claude.ai → Configuración → Conectores → Vercel y que elija ese
  equipo al autorizar. Sin eso, pedirle capturas.
- «Más vistos» en Canales es lista curada (`CHANNEL_PRIORITY` en
  `lib/categories.ts`) + lo visto en el aparato. Para audiencia real haría
  falta telemetría agregada (y decidir si vale la pena).
- El buscador encuentra por nombre. Si el dueño pide «buscar por actor» o
  filtros de año/plataforma del Figma, son funciones nuevas sobre TMDB, no
  solo diseño.
