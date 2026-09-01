# El equipo

Seis: tú y cinco agentes. Cada agente es **dueño de una zona del código**, no de
un tipo de tarea. Es lo que evita que dos toquen el mismo archivo a la vez y lo
que deja que cada uno acumule contexto de lo suyo.

---

## Quién es quién

| Agente | De qué es dueño | Cuándo lo llamas |
|---|---|---|
| **canales** | Televisión en directo: Canales, reproductores, M3U, EPG, zapping | «El canal no arranca», «la lista va lenta», «el zapping falla» |
| **catalogo** | Películas y series: TMDB, ficha, paginación, búsqueda, Mi enlace | «Faltan películas», «la ficha está mal», **«busca una API de audio latino»** |
| **diseno** | Cómo se ve todo. Único que edita `shell.css` y `globals.css` | «No se ve premium», «está descolocado», «esto no parece Apple TV» |
| **calidad** | Salud del código: CodeScene, pruebas, CI, código muerto | «Sube la nota», «esto da miedo tocarlo», «añade pruebas» |
| **dispositivos** | Probar en iPhone, PC y TV. **No arregla, encuentra** | Antes de fusionar algo visual, o «dame un repaso completo» |

Los cuatro dolores que señalaste tienen dueño:

- Probar en dispositivos reales → **dispositivos**
- El diseño nunca queda premium → **diseno**
- La nota de CodeScene → **calidad**
- Películas en español → **catalogo**

---

## Cómo los llamas

Están en `.claude/agents/`. Se invocan por nombre:

> «Usa el agente **diseno** para que la pestaña de Ajustes se vea como el resto»
>
> «Que **dispositivos** revise todo en iPhone antes de fusionar»
>
> «**catalogo**: investiga tres APIs de películas en español y compáralas»

También puedes lanzar varios a la vez si trabajan en zonas distintas. Lo que
**no** debes hacer es poner a dos en el mismo archivo: `diseno` y `canales`
pueden trabajar en paralelo, pero `diseno` y otro que también toque CSS, no.

---

## Las reglas del equipo

### 1. Cada agente abre un PR. Tú fusionas.

Nadie empuja a `main` ni a la rama de trabajo directamente. Ramas:
`agente/<nombre>/<lo-que-hace>`.

Esto arregla el mayor riesgo del informe de CodeScene: **63 commits y 0 pull
requests**. Sin PRs no hay revisión, y cada cambio entra sin que nadie más lo
lea. Con cinco agentes trabajando, eso pasaría de incómodo a peligroso.

### 2. Cada agente escribe su memoria

En `docs/equipo/<nombre>.md`. Qué hizo, qué decidió y qué aprendió. Es lo que
hace que la sesión siguiente no empiece de cero.

**Lo primero que hace un agente es leer su documento. Lo último, actualizarlo.**

### 3. Nadie cruza a la zona de otro

Si `canales` necesita un cambio en `src/lib/catalog/`, lo dice en el PR en lugar
de hacerlo. Un archivo, un dueño.

La excepción es `calidad`, que puede refactorizar en cualquier sitio — pero
**solo con cambios que no alteran comportamiento**. Si el refactor exige cambiar
lo que la app hace, lo pasa al dueño.

### 4. `npm run verify` antes de cada commit

Tipos, estilo, pruebas y build. **Antes de cada uno, no al final de todos**: si
algo se rompe, hay que saber cuál lo rompió.

### 5. Lo que tocas en `src/lib`, lo pruebas

Es donde las reglas se rompen en silencio. Cambiar una expresión regular no da
error de compilación, y te enteras cuando a alguien se le queda un canal fuera
de su categoría.

---

## Lo que todos deben saber antes de escribir una línea

Estas tres han costado horas cada una. Están en cada definición de agente, pero
si solo lees una cosa de este documento, que sea esta:

**Turbopack sirve CSS viejo.** Lanzar `npm run build` con `npm run dev` en
marcha deja `.next` sirviendo la hoja anterior. Se midieron tres veces cifras
idénticas creyendo que un arreglo no funcionaba. Ante una medición rara: mata el
servidor por PID, `rm -rf .next`, arranca otra vez.

**El orden de capas de CSS.** Una regla sin capa gana a cualquier regla en capa,
sin importar la especificidad — y con `!important` el orden se invierte. De ahí
salieron los dos únicos fallos visuales serios del proyecto.

**Cada campo de `Channel` viaja 7.822 veces.** La lista se serializa entera en
el HTML. Un campo de treinta caracteres son 230 KB más que descargar e
interpretar. Ya se retiraron cuatro campos por esto: sumaban 1,4 MB.

---

## Dónde está cada cosa

| Documento | Para qué |
|---|---|
| [`ARQUITECTURA.md`](ARQUITECTURA.md) | Dónde vive cada cosa y por qué. **Lectura obligatoria.** |
| [`SALUD-CODIGO.md`](SALUD-CODIGO.md) | Informe de CodeScene y hoja de ruta |
| [`FUENTE-PROPIA.md`](FUENTE-PROPIA.md) | El contrato de «Mi enlace» |
| [`SEGURIDAD.md`](SEGURIDAD.md) | Qué se protege, qué **no**, y por qué |
| `equipo/<nombre>.md` | La memoria de cada agente |
