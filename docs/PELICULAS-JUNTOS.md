# Nuestras películas

Películas propias para **Ver juntos**: se suben a Cloudflare R2 desde el PC
con un script, y aparecen solas en Mi enlace → «Nuestras películas», en todos
los aparatos, con sus audios (latino, inglés…) y subtítulos.

Todo gratis: R2 da 10 GB y no cobra por ver. Con películas de 2–5 GB caben dos
o tres a la vez; al terminar se borra una y queda sitio para la siguiente.

---

## Preparación (una sola vez)

### 1. El bucket de R2

En [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**.
La primera vez puede pedir activar R2 con una tarjeta; con el plan gratis no
cobra mientras no se pasen los 10 GB.

1. **Create bucket** → nombre `canalcasa-peliculas` → Create.
2. En el bucket → **Settings** → **Public access** → **R2.dev subdomain** →
   **Allow**. Copia la URL que da (`https://pub-….r2.dev`).
3. En **Settings** → **CORS policy** → **Add CORS policy**, pega esto y guarda.
   Sin esto, el navegador no deja leer la película desde la app:

   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["Content-Length", "Content-Range"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```

   `*` en vez del dominio de la app a propósito: las películas ya son públicas
   por su URL, y así funcionan igual la web, el APK de Android TV y la app de
   Tizen, que no siempre se presentan con el mismo origen.

4. Vuelve a **R2 Object Storage** → **Manage API tokens** (o *API* → *Manage
   API tokens*) → **Create API token**:
   - Permisos: **Object Read & Write**.
   - Aplicar solo al bucket `canalcasa-peliculas`.
   - Copia **Access Key ID**, **Secret Access Key** y el **endpoint**
     (`https://<tu-cuenta>.r2.cloudflarestorage.com`). El secreto solo se ve una
     vez. **No lo pegues en ningún chat.**

### 2. Las herramientas del PC (Windows)

En una terminal (tecla Windows → «Terminal»):

```powershell
winget install Gyan.FFmpeg
winget install Rclone.Rclone
```

Cierra la terminal y abre otra (para que encuentre los programas). Después,
conecta rclone con tu bucket, sustituyendo los tres valores:

```powershell
rclone config create r2 s3 provider Cloudflare access_key_id TU_ACCESS_KEY_ID secret_access_key TU_SECRET endpoint https://TU_CUENTA.r2.cloudflarestorage.com acl private no_check_bucket true
```

Prueba: `rclone lsd r2:canalcasa-peliculas` no debe dar error (vacío es normal).

### 3. La app

En Vercel → Settings → Environment Variables:

| Name | Value | Tipo |
|---|---|---|
| `NEXT_PUBLIC_PELICULAS_URL` | la URL `https://pub-….r2.dev` del paso 1.2 | Config |

Y redespliega. Sin esta variable, «Nuestras películas» no aparece.

---

## Subir una película

1. Deja la película como **`Descargas\Peliculas\pelicula.mkv`** (o `.mp4`).
2. **Doble clic en `scripts\peliculas\subir-pelicula.cmd`.**
3. Escribe el título (si el MKV trae uno en sus metadatos, lo sugiere: Enter
   para aceptarlo). Con él se nombra la carpeta en R2; si ya existe una igual,
   avisa y ofrece subirla con otro nombre (`coco-2`), sobrescribirla o cancelar.
4. Al terminar, el archivo se mueve a `Descargas\Peliculas\subidas\` para no
   volver a subirlo por error, y se borra la copia de trabajo de `Temp`.

También se puede arrastrar cualquier archivo sobre el `.cmd`; ese no se mueve.

La primera vez pregunta el remoto (`r2`), el bucket (`canalcasa-peliculas`) y
la URL pública, y lo guarda. Luego:

- Si el vídeo ya es H.264 de 8 bits hasta 1080p, **se copia**: minutos.
- Si es H.265/HEVC, 10 bits, 4K o HDR, **se recodifica** a H.264 para que lo
  reproduzca cualquier tele. Con tarjeta gráfica NVIDIA, Intel o AMD se usa
  sola; sin ella, la CPU puede tardar casi lo que dura la película.
- Todos los audios quedan elegibles en el reproductor (botón de audio). El
  primero es el español; para otro: `subir-pelicula.cmd "peli.mkv" -AudioPrincipal eng`.
- Subtítulos: solo **español e inglés** (forzados incluidos); un MKV puede
  traer 40 pistas y el selector se volvería inmanejable. Los **de texto** (SRT,
  ASS) se convierten; los de **imagen** (PGS de Blu-ray) no se pueden pasar a
  texto y se omiten avisando.
- ¿El archivo no trae los subtítulos que quieres? Deja el `.srt` **al lado,
  con el mismo nombre**: `pelicula.es.srt`, `pelicula.en.srt`,
  `pelicula.es.forced.srt` (sin idioma en el nombre se toma como español). Se
  incluyen siempre, se arreglan los acentos si vienen en codificación de
  Windows, y se mueven a `subidas\` con la película.
- Tamaño: con `-Calidad 24` (por defecto), una película de 1080p y 2 h queda
  en unos 1,5–2,5 GB, con techo de 6 Mb/s. Solo aplica si se recodifica; si
  el vídeo se copia, pesa lo que pesaba.

Opciones, añadidas detrás del archivo:

| Opción | Para qué |
|---|---|
| `-Titulo "Coco"` | El nombre que se ve en la app, sin preguntar |
| `-Calidad 26` | Archivo más pequeño (16–32; más alto = más pequeño y algo menos nítido) |
| `-Subtitulos "spa,eng,jpn"` | Qué idiomas de subtítulos se quedan (`todos` para no filtrar) |
| `-AudioPrincipal eng` | Con qué audio arranca |
| `-Recodificar` | Recodificar aunque se pudiera copiar |
| `-Aceleracion cpu` | No usar la tarjeta gráfica (si da problemas) |
| `-SoloConvertir` | Convertir sin subir, para revisar antes |

## Añadir subtítulos a una película ya subida

Sin reconvertir ni volver a subir el vídeo; tarda segundos.

1. Baja el `.srt` (por ejemplo de opensubtitles.com) y déjalo en
   `Descargas\Peliculas` o en `subidas\`. Con `es`, `en` o `forced` en el
   nombre se detecta el idioma (`catching.fire.es.srt`); si no dice nada, se
   toma como español.
2. **Doble clic en `Agregar subtitulos.cmd`** (o arrastra el `.srt` encima).
   Pregunta a qué película va y, si hay varios `.srt`, cuál.
3. Ábrela en la app y elige el subtítulo en el botón de subtítulos.

Arregla solo los acentos si el `.srt` viene en codificación de Windows. Si la
película ya tenía un subtítulo con el mismo nombre (otro «Español»), pregunta
si reemplazarlo (por defecto) o añadir otro.

**Si va desfasado** (salen antes o después que las voces):

- **Automático, con alass**: descarga el zip de Windows de
  [github.com/kaegi/alass/releases](https://github.com/kaegi/alass/releases) y
  pon `alass-cli.exe` en `%LOCALAPPDATA%\Microsoft\WinGet\Links` (la carpeta
  donde winget dejó ffmpeg, que ya está en el PATH). A partir de ahí, cada
  subtítulo se alinea solo con el audio de la película que esté en `subidas\`.
- **A mano**: vuelve a lanzarlo desde una terminal con un desfase en segundos y
  elige el mismo `.srt` (reemplaza al anterior):

  ```powershell
  & "$env:USERPROFILE\Downloads\Peliculas\Agregar subtitulos.cmd" -Desfase 1.5
  ```

  Positivo **retrasa** los subtítulos (úsalo si salen *antes* que la voz);
  negativo los **adelanta** (si salen *después*).

## Borrar una película

```
scripts\peliculas\borrar-pelicula.cmd              (lista lo subido y el espacio usado)
scripts\peliculas\borrar-pelicula.cmd coco         (borra «coco»)
```

---

## Ver juntos

Una sola sala para la casa. Cada aparato se vincula **una vez**:

1. Mi enlace → **Vincular a la sala** → elige un nombre («Tele sala», «Steven»…)
   y escribe el PIN de la sala (`SALA_PIN` en Vercel) con los números del mando
   o con el teclado de la pantalla.
2. Desde ahí, en ese aparato solo sale **Entrar a la sala**. Sin códigos.

Para ver algo:

1. Los dos: **Entrar a la sala**. Se ven los dos círculos encendidos.
2. Cualquiera elige una de **Nuestras películas**: le llega a los demás sola,
   con sus audios y subtítulos. **La última elegida manda**, también de un día
   para otro: cada aparato recuerda la última que conoce y, al encontrarse, gana
   la más nueva.
3. **Empezar**: cuenta atrás 3·2·1 en todos y arranca a la vez.

Dirige quien eligió la película (su pulso corrige a los demás); si se va, lo
hereda quien lleve más tiempo dentro. Play, pausa y saltos de cualquiera pasan
en todos. Cada uno elige su audio y sus subtítulos. Si uno sale de Mi enlace
(Atrás en el mando), se pausa para todos, y al volver se entra sola.

**Desvincular a todos**: cambiar `SALA_PIN` o `SALA_SECRETO` en Vercel y volver
a desplegar. Cada aparato lo nota al entrar y vuelve a pedir el PIN.

---

## Por qué así

- **HLS y no el MKV tal cual**: los navegadores no abren MKV, y una tele vieja
  no decodifica H.265 ni AC3/DTS. HLS con H.264 + AAC lo reproduce todo lo que
  esta app soporta, y permite saltar a cualquier minuto sin bajar el archivo.
- **Los audios dentro del HLS y los subtítulos aparte**: los audios se cambian
  en el reproductor sin cortar; los `.vtt` van por `<track>`, que la app ya
  pinta en su propia capa (sobrevive a la pantalla completa en las teles).
- **Un `catalogo.json` en el bucket**: lo escribe el script y lo lee la app.
  No hace falta base de datos ni tocar Vercel por cada película.
- **`r2.dev`** tiene un límite de peticiones pensado para pruebas, de sobra
  para dos personas. Si algún día se queda corto, se conecta un dominio propio
  al bucket y se cambia `NEXT_PUBLIC_PELICULAS_URL`.

Código: `scripts/peliculas/`, `src/lib/ver-juntos/catalogo.ts`,
`src/hooks/use-nuestras-peliculas.ts` y la sala en `src/hooks/use-ver-juntos.ts`.
