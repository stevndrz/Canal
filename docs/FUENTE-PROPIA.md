# Fuente propia y Watch Party

Documento de base para construir la tercera vía de reproducción de CanalCasa:
**un enlace que aporta la persona** (`.mp4`, `.mkv`, `.m3u8`, o cualquier
archivo alojado), y el **Watch Party exclusivamente ahí**.

No es una funcionalidad a medias: es el contrato, las piezas que ya existen y
las decisiones ya tomadas, para que quien la escriba no tenga que resolverlas
otra vez. El código de arranque está en `src/lib/fuente-propia/`.

---

## Por qué el Watch Party solo tiene sentido aquí

Los tres orígenes de la app no son equivalentes, y esto es lo que decide dónde
va la sincronización:

| Origen | Qué es | ¿Se puede sincronizar? |
|---|---|---|
| **Canales** | Lista M3U, señal en directo | **No hace falta.** Dos personas en el mismo canal ya van iguales: una emisión en vivo no se pausa ni se busca |
| **Películas** | `<iframe>` de un proveedor externo (VidSrc y compañía) | **No se puede.** El `<video>` vive en otro dominio: desde aquí no se lee su tiempo ni se controla. No es difícil, es imposible |
| **Fuente propia** | Un `<video>` nuestro | **Sí.** Tenemos el elemento, su tiempo y sus controles |

Por eso el botón de Watch Party debe **desaparecer** de los otros dos sitios
cuando esta pantalla exista, en lugar de quedarse ahí sin poder cumplir.

---

## Lo que ya está hecho y hay que reutilizar

No reimplementar nada de esto:

| Pieza | Dónde | Qué resuelve |
|---|---|---|
| Sincronización | `src/hooks/use-watch-party.ts` | Play, pausa y salto igualados por Pusher. Estados: `idle`, `connecting`, `connected`, `error` |
| Identidad de sala | `src/lib/watch-party/sign.ts` | `normalizeRoomId()`, el patrón `WATCH_PARTY_CHANNEL`, y la firma del canal privado |
| Autenticación | `src/app/api/pusher/auth/route.ts` | Ya funciona; no tocar |
| Reproductor con pistas | `src/components/native-player.tsx` | Audio, subtítulos y Watch Party sobre un `<video>` propio. **Es el reproductor que toca usar aquí**, no `StreamPlayer` |
| Barra de controles | `src/components/player/player-controls.tsx` | La misma de Inicio y pantalla completa, con su jerarquía y su ajuste de controles grandes |
| Detección de formato | `src/lib/fuente-propia/url.ts` | `claseDeUrl()`, `avisoDeClase()`, `tituloDesdeUrl()`, `urlUtilizable()` |
| Tipos del dominio | `src/lib/fuente-propia/types.ts` | `FuentePropia`, `SalaFuentePropia`, `ClaseFuente` |
| Guardar en el dispositivo | `src/hooks/use-persisted-set.ts` | El patrón de persistencia en `localStorage` que ya usan favoritos y recientes |

---

## Lo que falta por construir

1. **Pantalla** — una vista más del App Shell, con su entrada en `NAV_ITEMS`
   (`src/components/app-nav.tsx`) y su caso en `dashboard.tsx`. Envolverla en
   `.screen tv-safe` como el resto.
2. **Alta de un enlace** — campo + validación con `urlUtilizable()`, clase con
   `claseDeUrl()`, aviso con `avisoDeClase()` y nombre por defecto con
   `tituloDesdeUrl()`.
3. **Lista de fuentes guardadas** — en `localStorage`, con el patrón de
   `use-persisted-set.ts`. Reutilizar `MediaCard` y `MediaRail` para pintarlas.
4. **Reproducción** — `NativePlayer`, no `StreamPlayer`: el primero ya trae
   pistas de audio, subtítulos y el enganche del Watch Party.
5. **Sala** — crear o unirse con `normalizeRoomId()`, y pasar la sala a
   `useWatchParty`.
6. **Retirar el Watch Party** de Películas (`title-detail.tsx`) y del
   reproductor de canales (`fullscreen-player.tsx`), donde no puede funcionar.

---

## Trampas que ya nos han mordido en este proyecto

Están aquí porque cuestan una tarde cada una:

- **`hls.js` y `mpegts.js` no pueden llegar al servidor.** Tocan `self` al
  evaluarse y tumban la página con un 500. Cualquier componente que los use se
  carga con `next/dynamic({ ssr: false })`, y `next.config.ts` los marca como
  `serverExternalPackages`. Ya pasó en producción una vez.
- **El orden de las capas CSS manda.** Los restablecimientos de elemento van en
  `@layer base`, el CSS copiado de ARVIO en `@layer arvio`, y lo propio suelto
  al final de `globals.css`. Con `!important` **el orden se invierte**: una
  `!important` sin capa pierde ante una `!important` con capa.
- **Todo elemento con `data-nav` tiene que poder recibir el foco.** `.focus()`
  sobre un `<div>` no hace nada y no avisa: la navegación con mando se atasca
  en silencio.
- **`next/image` exige declarar cada host** o lanza y tumba la ruta entera. Para
  enlaces que aporta la persona, de dominios que no se conocen de antemano, usar
  `<img>` normal.
- **CORS decide si un enlace se puede reproducir.** Un `.mp4` alojado sin
  cabeceras CORS no se reproduce desde el navegador por mucho que la URL sea
  correcta. Conviene decirlo en el mensaje de error en vez de dejar un
  rectángulo negro.
- **Nunca aceptar un enlace sin validar el protocolo.** `urlUtilizable()` existe
  para que un `javascript:` pegado en el campo no acabe en el `src` de un
  `<video>`.
- **Cada pantalla nueva pasa la auditoría** descrita en la Fase 5.5 de
  `docs/PLAN-ARVIO.md`: sin botones sin nombre accesible, sin objetivos táctiles
  por debajo de 44px, alcanzable desde el teléfono, y recorrible con mando.

---

## Nota sobre trabajar en paralelo

Esta rama de trabajo toca sobre todo archivos nuevos bajo
`src/lib/fuente-propia/` y una vista propia. Los puntos de contacto con lo
existente son pocos y conviene tenerlos localizados para evitar conflictos:

- `src/components/app-nav.tsx` — una entrada más en `NAV_ITEMS`
- `src/components/dashboard.tsx` — un caso más en el `switch` de vistas
- `src/lib/types.ts` — `ViewId` gana un valor
- `src/components/catalog/title-detail.tsx` y `src/components/fullscreen-player.tsx`
  — de ahí se **quita** el Watch Party
