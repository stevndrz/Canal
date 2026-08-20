# Extractor de enlaces directos

Servicio que busca una película en un sitio de origen y devuelve su `.mp4`
directo. La aplicación lo usa para el servidor **«Directo»** de la ficha: en
vez de incrustar el reproductor de otro (un `iframe` del que no se puede saber
nada), reproduce un archivo de vídeo en un `<video>` propio.

---

## Por qué es un servicio aparte y no una ruta de Next

Tres razones, y cualquiera de ellas bastaría:

| | |
|---|---|
| **Necesita un navegador de verdad** | La cadena de páginas hasta el enlace solo existe si se ejecuta JavaScript. Son ~400 MB de Chromium. |
| **Tarda entre 10 y 30 segundos** | Vercel corta las funciones a los 10 s en el plan gratuito. |
| **Consume memoria a ráfagas** | Cada pestaña son ~150 MB. Eso no cabe en una función sin servidor. |

Va en una máquina que esté encendida: un VPS pequeño, un Raspberry Pi, o el
mismo ordenador de casa. **La aplicación funciona sin él** — el botón
«Directo» aparece y explica que falta configurarlo, y los demás servidores
siguen igual.

---

## Por qué se busca en caliente y no se guarda

Los enlaces vienen firmados y caducan en unas horas. Un catálogo con enlaces
guardados funcionaría el día que se rellena y estaría roto al siguiente, sin
decir por qué. Se busca en el momento del clic o no se busca.

Lo que sí hay es un caché **en memoria y corto** (30 min por defecto): si tres
personas de la casa abren la misma película la misma tarde, se recorre el sitio
una vez.

---

## Arrancarlo

### Con Docker (recomendado)

```bash
cd servicios/extractor
docker build -t canalcasa-extractor .
docker run -d --name extractor -p 8000:8000 \
  -e ORIGENES_PERMITIDOS=https://tu-app.vercel.app \
  canalcasa-extractor
```

La imagen base trae Chromium y sus librerías del sistema. Instalarlas a mano
sobre una `python:slim` son unas cuarenta líneas de `apt-get` que se rompen en
cada actualización de Debian.

### A mano

```bash
cd servicios/extractor
pip install -r requirements.txt
playwright install chromium          # ~400 MB, una sola vez
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Y en la aplicación

```bash
EXTRACTOR_URL=http://192.168.1.50:8000
```

Sin esa variable el botón «Directo» aparece deshabilitado y dice qué falta.
El navegador **nunca** habla con el extractor directamente: pasa por
`/api/extraer`, así su dirección no sale al cliente y no hay que abrirle CORS
a un origen público.

---

## Ajustes

| Variable | Por defecto | Para qué |
|---|---|---|
| `ORIGENES_PERMITIDOS` | `http://localhost:3000` | Orígenes con CORS. **Ponerlo en producción.** |
| `DOMINIOS_PERMITIDOS` | `cinecalidad.am,www.cinecalidad.am` | Los únicos sitios que se visitan |
| `CACHE_SEGUNDOS` | `1800` | Cuánto se reutiliza un enlace ya extraído |
| `TIMEOUT_MS` | `45000` | Tope por petición |
| `MAX_SIMULTANEOS` | `2` | Navegados a la vez. Cada uno ~150 MB |
| `CHROMIUM_PATH` | *(vacío)* | Chromium alternativo, si ya hay uno en la máquina |

---

## La lista de dominios no es opcional

`DOMINIOS_PERMITIDOS` es lo que impide que este servicio sea un **proxy
abierto**. Sin ella, cualquiera que le llegue podría pedirle que visitara

```
http://169.254.169.254/latest/meta-data/     # credenciales del proveedor
http://192.168.1.1/                          # el router de la casa
```

y le devolviera lo que encontrase — desde dentro de la red donde corre, que es
justo el sitio desde el que más daño se hace. Está comprobado que las rechaza:

```bash
curl "http://127.0.0.1:8000/extraer?url=http://169.254.169.254/latest/meta-data/"
# {"estado":"rechazado","motivo":"Ese dominio no está en la lista permitida…"}
```

Si algún día se añade otro sitio, se añade **su dominio**, nunca un comodín.

---

## La API

### `GET /salud`

```json
{ "estado": "ok", "navegador": true, "en_cache": 3 }
```

### `GET /extraer`

Dos formas de pedir una película:

- `?titulo=El+viaje+de+Chihiro&anio=2001` — se busca primero en el sitio. Es
  lo que usa la aplicación, porque de TMDB solo salen título y año.
- `?url=https://…` — la ficha exacta, si algún día se guardan en
  `catalog.json`.

La respuesta **siempre** lleva `estado`, y nunca es un 500 con una traza: que
un sitio ajeno falle es lo normal aquí, no una excepción del programa.

| `estado` | Qué pasó | Qué hacer |
|---|---|---|
| `ok` | Sale también `url` | Reproducir |
| `no_encontrado` | No está, o no ofrece descarga directa | Probar otro servidor |
| `timeout` | El sitio no respondió a tiempo | Reintentar |
| `rechazado` | Dominio fuera de la lista, o falta el título | Revisar la llamada |
| `error` | El sitio cambió su HTML, o no hubo red | Mirar los registros |

---

## Cuando deje de funcionar

Va a pasar: el sitio de origen cambia su HTML cuando quiere y aquí se depende
de textos de enlace concretos («HD quality», «Descargar archivo», «Enlace de
descarga directa»). Por eso cada paso comprueba que encontró lo que buscaba y
devuelve `no_encontrado` en vez de reventar.

Para arreglarlo, lanzarlo con cabeza y mirar dónde se queda:

```python
_navegador = await _playwright.chromium.launch(headless=False)  # en arrancar()
```

Los selectores están todos juntos en `_extraer()`, que son diez líneas.
