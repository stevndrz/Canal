# Salud del código: lectura del informe y hoja de ruta

Análisis del informe de CodeScene del 20 de agosto de 2026, y lo que se hizo
con él.

---

## Lo primero: lo que el informe NO dice

El PDF es el **Overview Report**. Da las cifras agregadas y nada más:

| Métrica | Valor |
|---|---|
| Líneas de código | 5.789 en 71 archivos |
| Código sano (verde) | 55% — 3.184 LOC |
| Problemático (amarillo) | 45% — 2.605 LOC |
| Insano (rojo) | **0%** |
| Salud media | 9,1 |
| Salud de los hotspots | 8,9 |
| Peor archivo | **7,3** |
| Riesgos activos | ninguno |

**No trae la lista de hotspots por archivo.** Donde debería estar dice *«To see
more details, please access your dashboard»*. Así que la petición de «prioriza
los 3 hotspots según salud y frecuencia de cambio» no se puede responder desde
este documento: los nombres de archivo no están en él.

Lo que sí se puede hacer —y es lo que se hizo— es **calcular lo mismo con los
datos que sí tenemos**. Un hotspot de CodeScene es frecuencia de cambio ×
complejidad; la primera sale de `git log` y la segunda se aproxima con
anidamiento y número de condicionales por archivo.

---

## Los tres hotspots, calculados

Medido el 21 de agosto de 2026 sobre 63 commits de historia:

| # | Archivo | Líneas | Anidamiento | Cambios | Índice |
|---|---|---|---|---|---|
| 1 | `components/dashboard.tsx` | 389 | 7 | **30** | 990 |
| 2 | `lib/m3u.ts` | 267 | 4 | 20 | 960 |
| 3 | `components/stream-player.tsx` | 386 | 8 | 11 | 638 |
| 4 | `components/catalog/title-detail.tsx` | **466** | **14** | 7 | 336 |

`title-detail.tsx` aparece cuarto por índice pero era **casi con seguridad el
7,3 del informe**: un solo componente de 388 líneas con catorce niveles de
anidamiento. El índice lo subestima porque se toca poco… precisamente porque da
miedo tocarlo.

Funciones por encima de 50 líneas encontradas:

```
title-detail.tsx     TitleDetail        388
dashboard.tsx        (componente)       287
fullscreen-player    onKeyDown          202
stream-player.tsx    (efecto principal) 141
fullscreen-player    FullscreenPlayer   105
stream-player.tsx    (montaje motor)     88
```

---

## Los riesgos de arquitectura

### 1. Un componente que lo sabe todo

`dashboard.tsx` posee la vista activa, el canal sintonizado, los ajustes, los
favoritos, los recientes, la búsqueda, la categoría, el reloj, el scroll y el
teclado. Treinta commits lo tocan: **casi la mitad de la historia del proyecto
pasa por un archivo**. Eso es lo que CodeScene llama un *hotspot* y lo que en
la práctica significa que dos cambios sin relación entre sí chocan en el mismo
sitio.

### 2. Lógica de dominio dentro de efectos de React

La elección de motor de vídeo —qué librería reproduce cada URL— vivía dentro de
un `useEffect` de 141 líneas, mezclada con el estado de React, el autoplay y la
limpieza. Consecuencia práctica: **no se podía probar sin montar un
componente**, así que no había ni una prueba de la regla más importante del
producto.

### 3. Dos verdades para la misma pregunta

`getStreamKind` (canales) y `claseDeUrl` (Mi enlace) clasificaban URLs por
extensión con reglas parecidas pero escritas por separado. El reloj estaba
implementado dos veces con el mismo `toLocaleTimeString`. Duplicar no rompe
nada el día que se escribe; rompe el día que uno de los dos cambia.

### 4. El lint no veía código muerto

El preajuste de Next no activa `no-unused-vars`. `npm run lint` pasaba limpio
con siete importaciones sin usar en `dashboard.tsx`, dos variables muertas en
`fullscreen-player.tsx` y un tipo sin usar en `catalog.ts`.

### 5. Riesgo de personas, no de código

3 contribuyentes, 63 commits, **0 pull requests**. El informe marca
*Knowledge Distribution: improving*, pero sin PRs no hay revisión: cada cambio
entra sin que nadie más lo lea. Es el riesgo más difícil de ver en las
métricas de código y el más caro cuando alguien se va.

---

## Hoja de ruta

### Fase 1 — Hecha ✅

| Qué | Resultado |
|---|---|
| Partir `title-detail.tsx` en cuatro piezas por responsabilidad | **466 → 122 líneas**, anidamiento de 14 a 5. Sale del top de hotspots |
| Sacar el conmutador de 8 vistas de `dashboard.tsx` a `vista-activa.tsx` | 389 → 319 líneas, y el `switch` sobre `ViewId` hace que TypeScript avise si falta una vista |
| Sacar la elección de motor a `lib/reproduccion/motor.ts` | El efecto baja de 141 a ~60 líneas, y la lógica queda **probada**: 5 pruebas nuevas |
| Unificar el reloj duplicado en `use-reloj.ts` | Una sola implementación |
| Activar `no-unused-vars` como error | Encontró y se limpiaron 10 símbolos muertos |

Cómo se comprobó que no se rompió nada: `npm run verify` (42 pruebas) más la
auditoría de Playwright sobre las 7 pantallas a 1920 y a 390 px.

### Fase 2 — Lo siguiente, por orden de retorno

1. **Extraer los hooks de `dashboard.tsx`.** Sigue siendo el hotspot número
   uno: 30 cambios y 319 líneas. Tres hooks candidatos, y cada uno es una
   preocupación distinta:
   - `useSintonizador()` — canal actual, zapping, recientes
   - `useNavegacionVistas()` — vista, vista anterior, atrás, `data-player`
   - `useAjustes()` — ajustes de reproducción y su persistencia

   Objetivo: por debajo de 150 líneas.

2. **`fullscreen-player.tsx`: partir `onKeyDown` (202 líneas).** Un mapa de
   `tecla → acción` en lugar de una cadena de `if`. Es la función más larga que
   queda en el proyecto.

3. **Unificar la clasificación de URLs.** `claseDeEmision` y `claseDeUrl` hacen
   lo mismo. Una sola función, un solo juego de pruebas.

4. **`m3u.ts`: separar descargar de interpretar.** 20 cambios y 19
   condicionales. Hoy un mismo módulo baja el archivo, lo cachea, lo analiza,
   clasifica cada canal y los ordena.

5. **Activar la integración de PRs de CodeScene.** Cero PRs en 63 commits: el
   análisis por PR es lo que convierte esto en un control continuo en lugar de
   una foto que hay que pedir.

### Cómo no romper nada al refactorizar

El orden importa, y es siempre el mismo:

1. **Extraer sin cambiar comportamiento.** Mover código, no reescribirlo. Si
   una función se puede copiar tal cual, se copia tal cual.
2. **`npm run verify` después de cada extracción**, no al final de todas.
3. **Auditoría de Playwright** antes de dar por buena una pantalla: los tipos
   no detectan que un panel se quedó fuera del render.
4. **Comparar la pantalla contra sí misma.** Antes de extraer, capturar qué
   pinta (títulos, contadores, número de elementos); después, comprobar que
   sale lo mismo. Así se hizo con la ficha: mismo título, mismos 12 actores,
   mismos 6 campos técnicos, mismos 4 servidores.
5. **Un refactor por commit.** Si algo se rompe tres días después, se necesita
   poder revertir uno sin arrastrar los otros.

---

## Qué esperar de la nota

El informe ya está en 0% de código rojo y 9,1 de media: no es un proyecto
enfermo. El margen está en el 45% amarillo, y ese amarillo son sobre todo
**funciones largas y anidamiento profundo**, que es exactamente lo que ataca la
Fase 1.

Dicho con honestidad: la nota la calcula CodeScene con más de 25 factores que
no son públicos, así que **no se puede prometer un número**. Lo que sí se puede
afirmar es que el peor archivo pasó de 466 líneas con catorce niveles a 122 con
cinco, y que eso es precisamente lo que el modelo penaliza.
