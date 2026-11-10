# Nuestras películas

Películas propias para **Ver juntos**: se dejan en una carpeta del PC, un doble
clic las sincroniza con Cloudflare R2, y aparecen solas en Mi enlace →
«Nuestras películas», en todos los aparatos, con sus audios (latino, inglés…)
y subtítulos.

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

Lo más fácil: desde la carpeta del repo, en una terminal,

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\peliculas\preparar-pc.ps1
```

Comprueba e instala con `winget` lo que falte (**Node.js 20+**, **ffmpeg**,
**rclone**) y crea en `Descargas\Peliculas` los accesos «Sincronizar
peliculas.cmd» y «Mirar que cambiaria.cmd».

Después, conecta rclone con tu bucket. **Hazlo con el asistente**, que pregunta
las llaves sin que queden escritas en ningún sitio:

```powershell
rclone config
```

`n` (nuevo) → nombre `r2` → tipo `s3` → proveedor `Cloudflare` → pega el Access
Key ID y el Secret cuando los pida → endpoint
`https://TU_CUENTA.r2.cloudflarestorage.com` → `acl` private → lo demás, Enter.

> Antes la guía decía `rclone config create … secret_access_key TU_SECRET`.
> Así el secreto queda en el historial de PowerShell
> (`%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt`).
> Si lo hiciste así, borra esa línea del archivo, o mejor: crea una llave nueva
> en Cloudflare, ponla con `rclone config` y borra la vieja.

Prueba: `rclone lsd r2:canalcasa-peliculas` no debe dar error (vacío es normal).

**Para proteger la llave** (recomendado): `rclone config` → `s` (*Set
configuration password*). rclone cifra su configuración y pide la contraseña
al sincronizar. Y que la llave de Cloudflare sea solo **Object Read & Write**
sobre `canalcasa-peliculas` (paso 1): si alguien la robara, no podría tocar
nada más de tu cuenta.

### 3. La app

En Vercel → Settings → Environment Variables:

| Name | Value | Tipo |
|---|---|---|
| `NEXT_PUBLIC_PELICULAS_URL` | la URL `https://pub-….r2.dev` del paso 1.2 | Config |

Y redespliega. Sin esta variable, «Nuestras películas» no aparece.

---

## Lo fácil: el panel con botones

Doble clic en **CanalCasa Peliculas.cmd** (en `Descargas\Peliculas`; lo crea
`preparar-pc.ps1`). Se abre en el navegador una página que solo existe en
tu PC, con la lista de películas y su estado («En la app ✓», «Por subir»,
«Cambios por subir», «Solo en la app»):

| Botón | Qué hace |
|---|---|
| **+ Agregar película** | Abre el selector de Windows. Elige el vídeo (y sus .srt, si quieres) de **cualquier carpeta**: USB, `D:\`… Se **copia** a la carpeta (el original no se toca) con sus subtítulos, y pregunta si subirla ya |
| **Descargar desde un enlace** | Pegas el enlace **directo** a un `.mkv` o `.mp4` y el PC lo baja a la carpeta, con barra de avance y «Cancelar descarga». Si se corta sigue por donde iba; si el enlace abre una página web y no el archivo, lo dice. No sobrescribe nada (« (2)») y comprueba antes que cabe en el disco |
| **Subir cambios (n)** | La sincronización de siempre, con barra de progreso. Si hay que borrar algo de la nube, pregunta |
| **+ Subtítulo** (en cada fila) | Copia un .srt al lado de esa película, con su nombre. Después, «Subir cambios» |
| **Borrar** (en cada fila) | Pregunta, y la quita **de la app y del PC**: sus archivos van a la **Papelera** (se pueden recuperar) |
| **Cambiar** (carpeta) | Usa otra carpeta como biblioteca; se recuerda (también para «Sincronizar peliculas.cmd») |

**Node.js**: los `.cmd` lo buscan solos en su carpeta de instalación
(`C:\Program Files\nodejs`…), comprueban que sea 20 o más nuevo y, si no lo
hay, ofrecen instalarlo con winget y siguen sin reiniciar. ffmpeg y rclone se
encuentran aunque el Explorador tenga el PATH de antes de instalarlos (se lee
el del registro).

La ventana negra que se abre con él es el panel: no la cierres mientras lo
uses. Se apaga sola 10 minutos después de cerrar la pestaña, o con «Cerrar
panel». Otro doble clic con el panel abierto vuelve a enseñar el mismo.

Es el mismo motor que «Sincronizar peliculas.cmd»: mismas reglas, mismo
candado (no corren los dos a la vez) y el mismo registro. Solo escucha en
`127.0.0.1` y cada sesión lleva un token aleatorio: nadie de la red lo ve,
y ninguna otra página abierta en el navegador puede pulsar sus botones.

## Subir, cambiar y borrar: sincronizar

`Descargas\Peliculas` **es** tu biblioteca: lo que esté ahí, está en la app.

1. Deja la película tal como la bajaste, con el nombre que traiga
   («Interstellar.2014.1080p.BluRay.x264.mkv»), y sus subtítulos al lado con un
   nombre que empiece igual («Interstellar.2014.1080p.BluRay.x264.es.srt»).
   O, si lo prefieres, **una carpeta por película** («Coco\» con el vídeo y los
   .srt dentro, con cualquier nombre): el título sale del nombre de la carpeta.
2. Doble clic en **Sincronizar peliculas.cmd**. Te enseña el plan, pregunta
   «¿Lo hago?» y lo hace.

| Haces en la carpeta | Pasa en la nube |
|---|---|
| Pones una película | Se convierte y se sube (con todos sus audios y subtítulos) |
| Pones, cambias o borras un `.srt` | Solo se suben o quitan esos subtítulos: el vídeo no se toca |
| Renombras el archivo o su carpeta | Cambia el título en la app (no se vuelve a subir) |
| Cambias el archivo por otra versión | Pregunta si reemplazarla |
| Quitas una película | **Pregunta** si borrarla de la nube. Si dices que no, puedes dejarla «solo en la nube» (para liberar disco) y no vuelve a preguntar |

- **El título** sale del nombre, sin lo técnico (calidad, códec, grupo):
  «The.Hunger.Games.Catching.Fire.2013.1080p.BluRay» → «The Hunger Games
  Catching Fire». Si quieres otro, renombra la carpeta o el archivo.
- **El idioma del subtítulo** sale del nombre: `es`, `spa`, `Spanish`,
  `Latino`, `en`, `English`, `forced`, `SDH`… Sin idioma, se toma por español.
  Si viene en codificación de Windows, se arreglan los acentos solo.
- **Lo que se está descargando** (`.part`, `.crdownload`, o tocado hace menos
  de 2 minutos) se salta hasta la siguiente vez.
- **Mirar que cambiaria.cmd** enseña el plan sin hacer nada.
- Las películas que subiste con el script de antes (en `subidas\`) se
  reconocen solas: no se vuelven a subir, ni sus subtítulos se duplican.

Opciones (escríbelas después del .cmd en una terminal):
`--calidad 26` (más pequeño al recodificar), `--aceleracion cpu`,
`--audio eng` (el que suena primero), `--subtitulos todos` (de los que trae el
vídeo dentro; por defecto español e inglés), `--recodificar`,
`--carpeta "D:\Pelis"`.

### Que se sincronice sola

Doble clic en **Sincronizar sola (activar o quitar).cmd** (en
`Descargas\Peliculas`; si no está, vuelve a ejecutar `preparar-pc.ps1`).
Crea una tarea de Windows que lanza la sincronización **cada 10 minutos, sin
ventana**, mientras tengas la sesión abierta. Con eso basta dejar la película
en la carpeta: cuando la descarga lleva dos minutos sin tocarse, se convierte
y se sube.

- **Nunca borra nada de la nube.** Si quitas una película de la carpeta,
  cambias un archivo por otro, borras un `.srt` o la nube se llenaría, lo deja
  como estaba y lo apunta como pendiente. Eso se decide con **Sincronizar
  peliculas.cmd**, que pregunta una a una.
- Lo que hizo la última vuelta —y lo pendiente— queda en **Estado de la
  sincronizacion.txt**, en la misma carpeta.
- **Desde el teléfono se ve cómo va**: cada vuelta (y el panel, y «Sincronizar
  peliculas.cmd») deja en el bucket un `peliculas/estado.json` y Mi enlace lo
  enseña: «Convirtiendo «Buddy» · 62 %», «Sincronizado hace 5 min · 7,2 de
  10 GB», «1 cosa por decidir en el PC». Es público como el catálogo: lleva el
  título, números y horas; nunca rutas del PC.
- Si una vuelta sigue convirtiendo o subiendo, la siguiente no hace nada.
- Mientras convierte usa la tarjeta gráfica (o la CPU): si justo estás
  jugando, lo vas a notar. Para apagarla un rato, el mismo `.cmd`.
- **Si cifraste la configuración de rclone** (`rclone config` → `s`), la tarea
  no puede escribir la contraseña. O la dejas sin cifrar —la llave solo puede
  leer y escribir en `canalcasa-peliculas`—, o defines la variable de usuario
  `RCLONE_PASSWORD_COMMAND` con una orden que la devuelva (ver `rclone help
  flags`, «password-command»). Sin una de las dos, el archivo de estado dirá
  «NO SE PUDO SINCRONIZAR».

A mano, desde una terminal: `node scripts\peliculas\sincronizar\tarea.mjs
activar | quitar | estado`.

### Por qué es fiable

- **Nada se borra sin preguntar**, y la respuesta por defecto es «no».
- Cada película se sube a una carpeta **nueva** (`interstellar-e77ad4`) y se
  comprueba que llegó entera (`rclone check`) **antes** de apuntarla en el
  catálogo: si se corta internet a la mitad, la app no ve una película rota.
  La siguiente sincronización ofrece borrar los restos.
- El catálogo se guarda tras cada paso, con una copia del anterior en
  `peliculas/catalogo.anterior.json`. Y si no se puede leer, no se escribe
  (nunca deja la app vacía por un fallo de red).
- Una sola sincronización a la vez; comprueba el espacio en disco y que no te
  pases de los 10 GB gratis antes de convertir.
- Registro de cada vuelta en `%LOCALAPPDATA%\CanalCasa\registro\`.

Código: `scripts/peliculas/sincronizar/` (Node, con pruebas: `npm test`); el panel es `panel.mjs` + `panel/index.html`.
Los scripts de antes (`subir-pelicula`, `agregar-subtitulos`,
`borrar-pelicula`) siguen en el repo por si acaso, pero ya no hacen falta.

---

## Ver juntos

Al abrir Mi enlace, lo primero es el estante **Nuestras películas**: se elige
una (en la tele, el mando entra directamente por ahí) y debajo queda su
reproductor.

1. Cada persona elige su **alias** la primera vez («Steven», «Tele sala»…).
   Sale en su círculo y en «Juntos · Steven ✓».
2. Uno pulsa **Crear sala**: sale un código de **4 cifras** en grande.
   Y el botón principal pasa a ser **Invitar**: abre la hoja de compartir del
   teléfono con un enlace (`…/?sala=8047`) que entra directo en la sala. En un
   PC, copia el enlace.
3. El otro abre ese enlace, o pulsa **Entrar con código** y lo escribe (con los números del mando
   o con el teclado de la pantalla). Le llega la película sola, con sus audios
   y subtítulos.
4. **Empezar**: cuenta atrás 3·2·1 en los dos y arranca a la vez.

**Todos mandan.** Pausar, reanudar, adelantar o saltar desde cualquier
aparato pasa en todos. Cada círculo dice cómo está esa persona: **Viendo**
(punto verde), **En la sala** o **Fuera un momento**.

**Salir de la app no saca de la sala.** Si contestas un mensaje y vuelves, la
app abre otra vez en la sala y se pone por donde van los demás (durante 6
horas; para salir de verdad, «Salir de la sala»).

### Seguir otro día

- **Volver a la sala 4821**: cada aparato recuerda la última sala. Si los dos
  pulsan ese botón, vuelven a encontrarse sin dictarse el código.
- **Retomar en 47:10**: mientras se ve en una sala, cada aparato apunta por
  dónde van. Al volver, el botón principal ofrece retomarlo —lo puede pulsar
  cualquiera y mueve a todos— y al lado queda «Desde el principio».
- **Vistas juntos**, al final de la pantalla: qué se vio, por dónde iban, con
  quién y cuándo. Tocar una la pone. Se guarda en cada aparato (no hay
  servidor): un aparato que no estuvo ese día no la tiene en su lista, pero
  recibe igual el «Retomar» del otro.

**La última película elegida manda**, la elija quien la elija. Dirige quien la
eligió (su pulso corrige al otro); si se va, quien lleve más tiempo dentro.
Play, pausa y saltos de cualquiera pasan en los dos. Si uno sale de Mi enlace
(Atrás en el mando), se pausa para los dos, y al volver se entra sola en la
misma sala.

El código no es secreto (10.000 salas): quien entrara por casualidad solo
podría pausar, y se le vería en la presencia con su alias.

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

Código: `scripts/peliculas/sincronizar/`, `src/lib/ver-juntos/catalogo.ts`,
`src/hooks/use-nuestras-peliculas.ts` y la sala en `src/hooks/use-ver-juntos.ts`.
