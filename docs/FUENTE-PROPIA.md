# Fuente propia

Documento de base para la tercera vía de reproducción de CanalCasa:
**un enlace que aporta la persona** (`.mp4`, `.mkv`, `.m3u8`, o cualquier
archivo alojado).

**Estado: funciona.** La pantalla vive en
`src/components/views/fuente-view.tsx` y se llega a ella por «Mi enlace» en la
barra. Este documento sigue siendo el contrato y la lista de lo que falta.

> Nota: el Watch Party (salas sincronizadas vía Pusher) se eliminó del
> proyecto. Este documento lo menciona solo donde conviene no reintentarlo.

---

## Por qué aquí hay controles completos y en las otras vías no

Los tres orígenes de la app no son equivalentes:

| Origen | Qué es | Reproducción |
|---|---|---|
| **Canales** | Lista M3U, señal en directo | Una emisión en vivo no se pausa ni se busca: barra de progreso no tiene sentido |
| **Películas** | `<iframe>` de un proveedor externo (VidSrc y compañía) | El `<video>` vive en otro dominio: desde aquí no se lee su tiempo ni se controla. No es difícil, es imposible |
| **Fuente propia** | Un `<video>` nuestro | Tenemos el elemento, su tiempo y sus controles |

---

## Lo que ya está hecho y hay que reutilizar

No reimplementar nada de esto:

| Pieza | Dónde | Qué resuelve |
|---|---|---|
| Reproductor con pistas | `src/components/native-player.tsx` | Audio y subtítulos sobre un `<video>` propio. **Es el reproductor que toca usar aquí**, no `StreamPlayer` |
| Barra de controles | `src/components/player/player-controls.tsx` | La misma de Inicio y pantalla completa, con su jerarquía y su ajuste de controles grandes |
| Detección de formato | `src/lib/fuente-propia/url.ts` | `claseDeUrl()`, `avisoDeClase()`, `tituloDesdeUrl()`, `urlUtilizable()` |
| Tipos del dominio | `src/lib/fuente-propia/types.ts` | `FuentePropia`, `ClaseFuente` |
| Guardar en el dispositivo | `src/hooks/use-persisted-set.ts` | El patrón de persistencia en `localStorage` que ya usan favoritos y recientes |

---

## Lo que ya está construido

- [x] **Pantalla** `fuente-view.tsx`, con su entrada en `NAV_ITEMS` y su caso en
  `dashboard.tsx`
- [x] **Alta de un enlace** con validación de protocolo, detección de clase,
  aviso honesto para `.mkv` y nombre derivado del archivo
- [x] **Lista guardada** en `localStorage` (`src/hooks/use-fuentes.ts`)
- [x] **Reproducción** con `NativePlayer`
- [x] **Continuar donde se quedó** — ver abajo

## Continuar donde se quedó

Hecho, pero **no** con `FuentePropia.progreso`, que era como estaba planteado
aquí. El progreso vive en su propio almacén (`src/lib/progreso.ts`,
`canalcasa:progreso`) con la misma forma para una fuente propia, una película y
un episodio. El motivo es que guardarlo también dentro de cada `FuentePropia`
serían dos verdades sobre lo mismo, y se desincronizan a la primera. El campo se
queda marcado como obsoleto para no romper lo que alguien ya tenga guardado en
su aparato; nadie lo escribe ni lo lee.

Cómo funciona: `NativePlayer` recibe una `claveProgreso` opcional
(`claveDeFuente(id)` aquí, `claveDeTitulo(...)` en el catálogo). Con ella,
apunta la posición cada cinco segundos —no en cada `timeupdate`, que son cuatro
por segundo y en un televisor se nota— y al pausar, terminar o salir. Al volver,
retoma en `loadedmetadata`, que es el primer instante en que el `<video>` acepta
un `currentTime`.

Y **terminar borra la entrada** en vez de guardarla al 100%: sin eso, «Seguir
viendo» acabaría siendo la lista de todo lo visto alguna vez.

## Lo que falta

1. **Pistas de subtítulos** — `ManualStream.subtitles` ya existe; falta poder
   añadir un `.vtt` junto al enlace.
2. **Varias calidades por título** — `NativePlayer` acepta un array de
   `ManualStream`; la pantalla solo pasa uno.
3. **La barra en la lista de guardados** — el progreso ya se guarda y se retoma,
   pero la lista de «Guardados en este dispositivo» todavía no lo enseña. En el
   catálogo sí se ve, porque `MediaCard` ya sabía pintarla. Aquí hace falta
   tocar `shell.css`, y eso es territorio del agente de diseño.

---

## Trampas que ya nos han mordido en este proyecto

Están aquí porque cuestan una tarde cada una:

- **`hls.js` y `mpegts.js` no pueden llegar al servidor.** Tocan `self` al
  evaluarse y tumban la página con un 500. Cualquier componente que los use se
  carga con `next/dynamic({ ssr: false })`, y `next.config.ts` los marca como
  `serverExternalPackages`. Ya pasó en producción una vez.
- **El orden de las capas CSS manda.** Los restablecimientos de elemento van en
  `@layer base` y lo propio al final de `globals.css`. Con `!important`
  **el orden se invierte**: una `!important` sin capa pierde ante una
  `!important` con capa.
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
- **Cada pantalla nueva pasa la auditoría de calidad**: sin botones sin nombre
  accesible, sin objetivos táctiles por debajo de 44px, alcanzable desde el
  teléfono, y recorrible con mando.

---

## Nota sobre trabajar en paralelo

Esta parte del código toca sobre todo archivos nuevos bajo
`src/lib/fuente-propia/` y una vista propia. Los puntos de contacto con lo
existente son pocos y conviene tenerlos localizados para evitar conflictos:

- `src/components/app-nav.tsx` — una entrada más en `NAV_ITEMS`
- `src/components/dashboard.tsx` — un caso más en el `switch` de vistas
- `src/lib/types.ts` — `ViewId` gana un valor
