# NOTICE

CanalCasa
Copyright 2026 stevndrz

Este producto incluye software desarrollado por el proyecto **ARVIO**
(https://github.com/ProdigyV21/ARVIO), distribuido bajo la Licencia Apache,
Versión 2.0. La copia íntegra de esa licencia está en
[`LICENSES/ARVIO-Apache-2.0.txt`](LICENSES/ARVIO-Apache-2.0.txt).

## Commit de referencia

Todo el material derivado proviene de un único punto del historial de ARVIO,
fijado aquí para que cualquier re-sincronización futura parta de la misma base:

| Campo  | Valor |
|--------|-------|
| Repo   | `https://github.com/ProdigyV21/ARVIO` |
| Commit | `5bd6a760068ee909692c3df1386af9d6a0d808af` |
| Fecha  | 2026-08-19 |
| Ruta   | `web/` (la aplicación de navegador; nada de la app Android) |

## Archivos derivados de ARVIO

La Apache 2.0 (§4b) obliga a señalar los archivos modificados. Esta tabla se
actualiza en el mismo commit en el que se añade cada archivo derivado.

| Archivo en CanalCasa | Origen en ARVIO | Modificaciones |
|----------------------|-----------------|----------------|
| `src/components/shell/top-nav.tsx` | `web/components/shell/TopNav.tsx` | Fuera el sistema de perfiles y la marca ARVIO; destinos desde `NAV_ITEMS` (admite rutas de Next, no solo vistas); reloj en lugar del avatar; `data-nav` para la navegación con mando. Se conservan sus nombres de clase, que son el contrato con el CSS. |
| `src/components/media/rail-scroller.tsx` | `web/components/media/RailScroller.tsx` | Textos de accesibilidad en español; `data-nav` para la navegación con mando. |
| `src/components/media/media-card.tsx` | `web/components/media/MediaCard.tsx` | Sin peticiones a TMDB desde la tarjeta (el catálogo llega resuelto del servidor); fuera Trakt, servidores domésticos y menú contextual; añadido monograma de respaldo. Se conserva su estructura de DOM y sus clases. |
| `src/components/media/media-rail.tsx` | `web/components/media/MediaRail.tsx` | El modo póster llega por prop en vez de leerse de un store global; recuento propio. |
| `src/components/livetv/live-tv-view.tsx` | `web/components/livetv/LiveTvScreen.tsx` | Fuera la gestión de listas M3U (aquí se configura por `M3U_URL`), el conmutador Lista/Guía, Catch-up, VLC y los avisos de Xtream. Render por lotes propio para 7.800 canales. Textos en español. |
| `src/components/livetv/channel-row.tsx` | `web/components/livetv/LiveTvScreen.tsx` (su `ChannelRow`) | Extraído a archivo propio; sin la carga perezosa de guía por fila; añadidos número de canal y monograma de respaldo. |
| `src/components/views/buscar-view.tsx` | `web/components/search/SearchScreen.tsx` | Conserva el teclado en pantalla de CanalCasa, que el original no tiene, en columna junto a los resultados. |
| `src/components/views/favoritos-view.tsx` | `web/components/watchlist/WatchlistScreen.tsx` | Solo el encabezado y la rejilla; fuera el selector de origen (Trakt, Jellyfin, Plex, Emby) y sus bibliotecas. |
| `src/components/live-card.tsx` | — | Obra propia. Reutiliza el lenguaje visual (`.live-dot`, variables de color) pero no deriva de ningún componente de ARVIO: su app no tiene un reproductor incrustado en la portada. |

Cada archivo derivado lleva además una cabecera con su ruta de origen y una
nota de modificación, de modo que la procedencia sea evidente al abrirlo sin
tener que consultar este documento.

### Sobre `src/app/shell.css`

Hasta agosto de 2026 este proyecto incluía `src/app/arvio-shell.css`, **copia
literal** de `web/app/globals.css` de ARVIO (12.704 líneas). Se retiró: de sus
577 clases la aplicación usaba 106, y pesaba 256 KB en producción.

`src/app/shell.css` lo sustituye y **está escrito de cero**. Conserva los
nombres de clase, que son el contrato con los componentes derivados listados
arriba, pero ninguna de sus reglas procede de ARVIO: la retícula, la
tipografía, el sistema de foco, la paleta y las consultas de medios son
propias, con un lenguaje visual distinto del original.

Los nombres de clase se documentan aquí por transparencia, no porque la
licencia lo exija: un identificador como `.rail-strip` no es material sujeto a
derechos de autor. La atribución de los **componentes** que los usan sigue
íntegra en la tabla.

### Archivos derivados que ya no existen

Quedan anotados porque estuvieron publicados en versiones anteriores de este
repositorio:

- **`src/components/media/hero.tsx`**, de la sección `.hero` de
  `web/components/home/HomeScreen.tsx`. Se retiró al decidir que en la portada
  manda el reproductor en directo y no una cabecera de película.
- **`src/app/arvio-shell.css`**, copia literal de `web/app/globals.css`.
  Sustituido por `src/app/shell.css`, escrito de cero (ver arriba).

## Lo que NO se ha tomado de ARVIO

La cláusula §6 de la Apache 2.0 **no concede derechos sobre marcas**. Por eso
quedan expresamente fuera, y no deben incorporarse en el futuro:

- El nombre «ARVIO» como identificador de este producto.
- `arvio-logo.svg`, `arvio-wordmark.svg` y los iconos de aplicación.
- La identidad visual presentada como marca.

CanalCasa es un producto independiente, con su propio nombre y su propia marca.
No está afiliado a ARVIO ni respaldado por sus autores.

## Sobre las fuentes de contenido

Igual que ARVIO, CanalCasa **no aloja, almacena, vende ni distribuye** películas,
series, canales de televisión, listas de reproducción ni ningún otro medio de
terceros. Es una interfaz para fuentes que configura la persona usuaria, que es
la única responsable de que su uso cumpla la legislación aplicable.
