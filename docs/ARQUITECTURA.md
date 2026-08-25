# Arquitectura de CanalCasa

> Si trabajas con el equipo de agentes, empieza por [`EQUIPO.md`](EQUIPO.md).

Este documento explica **dónde vive cada cosa y por qué**, para no tener que
deducirlo leyendo el árbol. Si añades algo y no sabes dónde ponerlo, la
respuesta está aquí; si no está, añádela.

---

## Las tres formas de ver algo

Toda la aplicación se organiza alrededor de tres orígenes de vídeo distintos,
que **no son intercambiables**. Casi cada decisión rara del código se explica
por cuál de los tres se está tocando:

| Origen | Qué es | Cómo se reproduce |
|---|---|---|
| **Canales** | Lista M3U, señal en directo | `stream-player.tsx` con hls.js o mpegts.js |
| **Películas** | Catálogo TMDB | `<iframe>` de un proveedor externo |
| **Mi enlace** | Un enlace que aporta la persona | `native-player.tsx`, un `<video>` nuestro con controles completos |

---

## Árbol

```
src/
├── app/                      Rutas de Next (App Router)
│   ├── layout.tsx            Fuente, metadatos, <html>
│   ├── page.tsx              Inicio. Server Component: descarga M3U y EPG
│   ├── peliculas/            Catálogo y ficha de un título
│   ├── globals.css           Tokens, restablecimientos, foco, pantallas propias
│   └── shell.css             El armazón visual: barra, rieles, tarjetas, canales
│
├── components/
│   ├── shell/                Cromo común (barra superior)
│   ├── views/                Una pantalla = un archivo
│   ├── media/                Tarjeta y riel, compartidos por todas las pantallas
│   ├── livetv/               La pantalla de Canales y su fila
│   ├── catalog/              Ficha de película, selector de servidor, buscador
│   ├── player/               Controles del reproductor
│   ├── stream-player.tsx     Directo (hls.js / mpegts.js)
│   ├── native-player.tsx     Enlace propio (<video> nuestro, audio y subtítulos)
│   └── fullscreen-player.tsx Pantalla completa
│
├── hooks/                    Estado con ciclo de vida (foco, cast, fuentes)
├── lib/                      Lógica pura: sin React, sin DOM, sin red donde se pueda
│   ├── config.ts             ⭐ ÚNICA fuente de configuración
│   ├── channels.ts           Filtrar, agrupar y numerar canales
│   ├── categories.ts         A qué categoría pertenece un canal
│   ├── m3u.ts                Descargar e interpretar la lista
│   ├── epg.ts                Guía XMLTV
│   ├── text.ts               Normalizaciones compartidas
│   ├── media-item.ts         Traduce Channel y ResolvedCatalogItem a CardItem
│   ├── reproduccion/         Qué librería reproduce cada enlace
│   ├── catalog/              TMDB, proveedores de iframe, catálogo propio
│   ├── fuente-propia/        Mi enlace: clasificar URLs, leer magnets
│   └── resolvers/            Contrato de /api/stream (tipos compartidos)
```

---

## Reglas que sostienen todo esto

### 1. `process.env` solo se lee en `src/lib/config.ts`

Antes lo leían siete archivos con siete criterios distintos para el valor por
defecto, y no había forma de responder de un vistazo a «¿qué se puede
configurar?». Ahora hay dos objetos:

- `publicConfig` — lo que el navegador puede ver (`NEXT_PUBLIC_*`)
- `serverConfig()` — lo que nunca sale del servidor (claves, secretos)

`serverConfig` es una **función** y no un objeto: en el navegador esas claves
están vacías, y un objeto evaluado al importar congelaría ese vacío.

Las variables `NEXT_PUBLIC_*` se escriben **literalmente**, nunca con índice
calculado: Next las sustituye en tiempo de compilación buscando el texto
exacto, así que `process.env[clave]` se quedaría vacío en el navegador.

### 2. Dos hojas de estilo, con un reparto claro

- **`shell.css`** — lo que se repite en todas las pantallas: barra, rieles,
  tarjetas, encabezados, rejillas, Canales, teléfono.
- **`globals.css`** — tokens de Tailwind, restablecimientos de elemento,
  sistema de foco, y las pantallas propias (ficha, Mi enlace, ajustes,
  reproductor, buscador, categorías).

**El orden de capas no es cosmético.** En CSS una regla *sin capa* gana a
cualquier regla *en capa*, pase lo que pase con la especificidad. Tailwind
emite sus utilidades en `@layer utilities`, así que el armazón entra en
`components`, por debajo. Cuando esto se hizo mal, un `button { color: inherit }`
del armazón derrotaba a una utilidad de Tailwind y el botón «Ver ahora» salía
blanco sobre blanco.

Y una vuelta de tuerca: **con `!important` el orden de las capas se invierte**.
Una declaración `!important` sin capa *pierde* ante una `!important` con capa.

### 3. Los reproductores se cargan con `next/dynamic({ ssr: false })`

`hls.js` y `mpegts.js` tocan `self` al importarse. Si llegan al paquete del
servidor, la página entera devuelve un 500 en producción — ya pasó dos veces
(`8c303e7`, `d2542cd`). Dos defensas, y hacen falta las dos:

- `next.config.ts` los marca como `serverExternalPackages`
- los componentes que los usan se importan con `next/dynamic({ ssr: false })`

**No romper ninguna de las dos al mover componentes.**

### 4. Las imágenes de canal van con `<img>`, no con `next/image`

Los logos de una lista IPTV vienen de cientos de dominios distintos.
`next/image` exige declarar cada uno en `remotePatterns` y **lanza una
excepción que tumba la ruta entera** si encuentra uno sin declarar. Ya pasó
con `/peliculas`. Solo TMDB está declarado, porque es un dominio fijo.

### 5. Un solo lenguaje de foco

En un televisor no hay puntero: el realce es lo único que dice dónde estás.

- Con puntero: `:focus-visible`
- Con mando: `:focus` a secas, activado por `data-input="dpad"` que pone
  `useRemoteInput` — un mando no tiene Tab, así que ahí el foco siempre se ve.

Las tarjetas se salen de esa regla y tienen su propio realce en `shell.css`:
crecen y se rodean de blanco, en lugar de dibujar un contorno alrededor del
botón.

---

## Cómo se verifica

```bash
npm run verify     # tipos + estilo + pruebas + compilación
```

Y por separado:

| Comando | Qué atrapa |
|---|---|
| `npm run typecheck` | Errores de tipo |
| `npm run lint` | Reglas de estilo y de hooks |
| `npm run test` | La lógica pura de `src/lib` |
| `npm run build` | Los fallos de SSR, que son los que tumban producción |

### Qué se prueba con qué, y por qué

**`vitest` cubre `src/lib`**: funciones sin React, sin red y sin navegador.
Es donde viven las reglas que se rompen en silencio — cambiar una expresión
regular no da error de compilación, y sin prueba te enteras cuando a alguien
se le queda un canal fuera de su categoría.

**Los componentes se verifican con Playwright contra la app de verdad.**
Montar React en jsdom pone a prueba el montaje, no el producto: no habría
detectado ninguno de los fallos reales de este proyecto (la rueda del ratón
muerta por `overflow-x`, el foco atrapado en la barra, el botón blanco sobre
blanco). La comprobación mínima recorre las siete pantallas a 1920 y a 390
buscando botones sin nombre, objetivos táctiles por debajo de 44px,
desbordamiento horizontal y encabezados tapados por la barra fija.

### Una trampa conocida de Turbopack

Lanzar `npm run build` con `npm run dev` en marcha deja `.next` en un estado
en el que el servidor de desarrollo **sigue sirviendo la hoja de estilo
anterior**. Si una medición sale rara, comprueba primero que la clase existe
en lo que se está sirviendo:

```bash
CSS=$(curl -s localhost:3000 | grep -oP '/_next/static/[^"]+\.css' | head -1)
curl -s "localhost:3000$CSS" | grep -c nombre-de-la-clase
```

Si da 0: matar el servidor, `rm -rf .next` y volver a arrancar.

---

## Configuración

Todo opcional: la aplicación arranca recién clonada sin preparar nada.

| Variable | Para qué | Por defecto |
|---|---|---|
| `M3U_URL` | Lista de canales | Un gist público |
| `EPG_URL` | Guía XMLTV | La que declare la lista, o ninguna |
| `TMDB_API_KEY` | Catálogo de películas | Token de solo lectura incluido |
| `NEXT_PUBLIC_CANAL_INICIAL` | Canal de arranque | `Canal 7` |
| `NEXT_PUBLIC_EMBED_PROVIDER_MOVIE` / `_TV` | Servidor propio de reproducción | Ninguno |
| `NEXT_PUBLIC_PUSHER_KEY` / `_CLUSTER` + `PUSHER_SECRET` | Watch Party | Sin ellas, «Ver en familia» se desactiva sola |

> ⚠️ El token de TMDB de reserva está en el historial de Git. Es de solo
> lectura del catálogo público y nunca sale hacia el navegador, pero si este
> repositorio deja de ser privado hay que rotarlo y dejar solo la variable.
