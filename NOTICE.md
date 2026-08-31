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
actualiza en el mismo commit en el que cambia la situación de un archivo.

### Los que siguen derivando

| Archivo en CanalCasa | Origen en ARVIO | Modificaciones |
|----------------------|-----------------|----------------|
| `src/components/livetv/live-tv-view.tsx` | `web/components/livetv/LiveTvScreen.tsx` | Fuera la gestión de listas M3U (aquí se configura por `M3U_URL`), Catch-up, VLC y los avisos de Xtream. Conmutador Lista/Parrilla propio. Render por lotes y ventana de filas propios, para 7.800 canales. Textos en español. |
| `src/components/media/media-card.tsx` | `web/components/media/MediaCard.tsx` | Sin peticiones a TMDB desde la tarjeta (el catálogo llega resuelto del servidor); fuera Trakt, servidores domésticos y menú contextual; añadido monograma de respaldo. Se conserva su estructura de DOM y sus clases. |

Los dos llevan cabecera con su ruta de origen y su nota de modificación, para
que la procedencia sea evidente al abrirlos.

### Los que se reescribieron (agosto de 2026)

Estos seis se volvieron a escribir siguiendo las convenciones de este proyecto,
y su cabecera de atribución se retiró en el mismo commit. Lo que quedaba en
ellos del origen era en su mayoría la forma genérica del componente —una fila de
lista, un carril horizontal, una rejilla con encabezado—, y las diferencias
funcionales ya eran grandes antes de reescribirlos.

| Archivo | Qué era antes | Qué se hizo al reescribir |
|---------|---------------|---------------------------|
| `src/components/shell/top-nav.tsx` | `web/components/shell/TopNav.tsx` | Reparto de `NAV_ITEMS` a constantes de módulo (dos `filter` corrían en cada render); marca extraída; documentación rehecha. |
| `src/components/media/rail-scroller.tsx` | `web/components/media/RailScroller.tsx` | Lógica de desplazamiento a `useDesplazamiento`, flecha única compartida por los dos modos — estaban escritos dos veces. |
| `src/components/media/media-rail.tsx` | `web/components/media/MediaRail.tsx` | Se deja de duplicar la invocación de `MediaCard` solo para envolverla en modo póster. |
| `src/components/livetv/channel-row.tsx` | `LiveTvScreen.tsx` (su `ChannelRow`) | Logo y bloque de emisión extraídos a subcomponentes; el estado del logo roto ya no repinta la fila entera. |
| `src/components/views/buscar-view.tsx` | `web/components/search/SearchScreen.tsx` | Tarjetas memorizadas —se recreaban en cada tecla y anulaban el `memo`— e índice por clave en vez de un `find` lineal. |
| `src/components/views/favoritos-view.tsx` | `web/components/watchlist/WatchlistScreen.tsx` | Lo mismo: una sola pasada para tarjetas e índice, sin `find` sobre 7.822 canales por clic. |

**Sobre retirar la atribución.** Que un archivo se haya reescrito es una
afirmación de ingeniería, no un dictamen legal. Se documenta aquí lo que se
hizo y cuándo para que quien tenga que decidirlo pueda hacerlo con el dato
delante. Este documento y `LICENSES/ARVIO-Apache-2.0.txt` se conservan en
cualquier caso: registran de dónde viene el proyecto, que es cierto lo reescriba
quien lo reescriba.

### Obra propia desde el principio

| Archivo | Nota |
|---------|------|
| `src/components/live-card.tsx` | Reutiliza el lenguaje visual (`.live-dot`, variables de color) pero no deriva de ningún componente de ARVIO: su app no tiene un reproductor incrustado en la portada. |
| `src/components/livetv/panel-canal.tsx` | Salió de `live-tv-view.tsx` en la reescritura, pero su contenido —`describirCanal`, la barra de programa, las acciones— es propio. |
| `src/components/livetv/parrilla-epg.tsx` | La parrilla EPG. ARVIO tenía un conmutador Lista/Guía que aquí nunca se portó; esta se pide por ventana de canales a `/api/guia`. |

### Sobre `src/app/shell.css`

Hasta agosto de 2026 este proyecto incluía `src/app/arvio-shell.css`, **copia
literal** de `web/app/globals.css` de ARVIO (12.704 líneas). Se retiró: de sus
577 clases la aplicación usaba 106, y pesaba 256 KB en producción.

`src/app/shell.css` lo sustituye y **está escrito de cero**. Conserva los
nombres de clase, que son el contrato con los componentes, pero ninguna de sus
reglas procede de ARVIO: la retícula, la
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
