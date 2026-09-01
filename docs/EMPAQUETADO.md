# Empaquetar CanalCasa para un televisor

> Para el código de la aplicación, [`ARQUITECTURA.md`](ARQUITECTURA.md).
> Aquí solo está lo que convierte la aplicación en un archivo instalable.

---

## Lo primero, porque cambia todo lo demás

**CanalCasa no se puede meter dentro del paquete.** No es una limitación de
Tizen ni de Android: es lo que esta aplicación es.

Tres cosas ocurren en el servidor y no pueden ocurrir en el televisor:

| Qué | Dónde vive | Por qué no puede bajar al televisor |
|---|---|---|
| `/api/buscar` | Servidor | Lleva la credencial de TMDB. En el paquete, cualquiera la extrae del APK con `unzip` |
| `/api/canales` | Servidor | Descarga y reordena una lista M3U de 8 MB; el televisor recibe 276 KB ya masticados |
| `/api/stream` | Servidor | Pregunta a cada proveedor si tiene la película antes de ofrecerlo (`disponibilidad.ts`) |

Y la portada es un Server Component: descarga la lista y la guía **antes** de
mandar el HTML. Un `output: "export"` no es una opción de configuración que
falte activar; sería reescribir la mitad de la aplicación y regalar la
credencial.

Así que el reparto queda así, y es el mismo que usan casi todas las
aplicaciones de televisor que existen:

```
                    ┌──────────────────────────────┐
                    │   La aplicación, en Vercel   │
                    │   (esto es CanalCasa)        │
                    └──────────────┬───────────────┘
                                   │ HTTPS
          ┌────────────────┬───────┴────────┬─────────────────┐
          │                │                │                 │
    ┌─────┴─────┐   ┌──────┴──────┐  ┌──────┴──────┐   ┌──────┴──────┐
    │ .wgt      │   │ .apk        │  │ Navegador   │   │ iPhone      │
    │ Samsung   │   │ TCL/Android │  │ del PC      │   │ (a inicio)  │
    └───────────┘   └─────────────┘  └─────────────┘   └─────────────┘
      empaque/tizen   empaque/android      —                 —
```

**La ventaja de que sea así**: publicas una corrección en Vercel y los dos
televisores la tienen en el siguiente arranque. Sin volver a empaquetar, sin
volver a instalar, sin pedirle nada a nadie. Ese es el motivo real por el que
casi nadie mete su aplicación dentro del `.wgt`, no la pereza.

**El precio**: sin internet no hay nada. Que en una aplicación cuyo contenido
son emisiones en directo no es un precio de verdad.

---

## Paso 0: publicar la aplicación (los dos paquetes lo necesitan)

Los dos paquetes apuntan a una dirección. Tiene que existir **antes** de
empaquetar nada.

```bash
npm run verify     # que compile antes de subirla, no después
```

Súbela a Vercel (README, sección *Despliegue*) y anota la dirección final.
Requisitos que no son negociables:

- **HTTPS.** El paquete de Android declara `usesCleartextTraffic="false"` y el
  navegador de Tizen bloquea el contenido mixto. Por HTTP, además, cualquiera
  en la red de casa ve y cambia lo que recibe la tele.
- **Dominio estable.** Cambiarlo obliga a reinstalar en cada televisor. Si
  piensas usar un dominio propio, ponlo antes de empaquetar.
- **`TMDB_API_KEY` configurada** en Vercel, o Cine y series sale vacía (los
  canales en directo funcionan igual, no dependen de TMDB).

Compruébalo desde el navegador del propio televisor antes de seguir. Si ahí no
funciona, empaquetarlo no lo va a arreglar: es la misma página.

---

## Samsung (Tizen) → archivo `.wgt`

Lo que hay en [`empaque/tizen/`](../empaque/tizen) es el paquete entero: tres
archivos.

### 1. Comprobar la dirección

En `empaque/tizen/index.html`, una línea:

```js
var URL_APP = "https://canal-sable.vercel.app/";
```

Viene puesta la del despliegue actual, así que si no has cambiado de dominio no
hay nada que tocar. Si la cambias por una que no exista, la app arranca y se
queda en negro: es el navegador del televisor el que decide, y no avisa.

### 2. Instalar Tizen Studio

Descarga **Tizen Studio** de [developer.tizen.org](https://developer.tizen.org)
y, dentro de su *Package Manager*, instala:

- `Tizen SDK Tools`
- **`Extension SDK → Samsung Certificate Extension`** ← sin esto no hay
  certificados y sin certificados no hay `.wgt`
- `Extension SDK → TV Extensions` (la versión que corresponda a tu televisor)

Necesita **Java 8 o superior** ya instalado.

### 3. Poner el televisor en modo desarrollador

En el televisor:

1. Menú **Apps**.
2. Con el mando, teclea `1 2 3 4 5`. Se abre un panel oculto.
3. **Developer mode: On**.
4. Escribe la **IP del PC** desde el que vas a instalar.
5. Reinicia el televisor (apagar y encender de verdad, no el mando).

Apunta la **IP del televisor** (Ajustes → Red → Estado). Desde el PC:

```bash
sdb connect 192.168.1.XX          # la IP del televisor
sdb devices                       # tiene que aparecer, con su nombre
```

`sdb` está en `~/tizen-studio/tools/`. Si no aparece nada, casi siempre es que
falta el paso 4 o el reinicio.

### 4. Los certificados (el paso que más se atasca)

En Tizen Studio: **Tools → Certificate Manager → + → Samsung → TV**.

Se crean **dos** certificados y hacen falta los dos:

- **Author**: te identifica. Pide tu cuenta Samsung. **Guarda la contraseña y
  haz copia del archivo**: si lo pierdes no puedes volver a firmar
  actualizaciones de la misma app, y hay que instalarla de cero.
- **Distributor**: autoriza a instalar en televisores concretos. Pide el
  **DUID** del televisor, que el Certificate Manager lee solo si el televisor
  está conectado por `sdb` (paso 3). Se pueden meter hasta 10 DUID.

> Si el certificado de distribución no incluye el DUID de un televisor, la
> instalación falla con un error genérico que no menciona el certificado. Es la
> causa del 90% de los `install failed` la primera vez.

### 5. Empaquetar e instalar

Desde `empaque/tizen/`:

```bash
tizen build-web -- .
tizen package -t wgt -s <nombre-del-perfil> -- .buildResult
tizen install -n CanalCasa.wgt -t <nombre-del-televisor>
```

`<nombre-del-perfil>` es el que le pusiste en el Certificate Manager;
`<nombre-del-televisor>` es lo que devolvió `sdb devices`.

Sale un `CanalCasa.wgt` en `.buildResult/` — **ese es el archivo instalable**.
Aparece en la fila de aplicaciones del televisor con su icono.

> El modo desarrollador **caduca**. La app instalada así deja de abrirse a los
> 30-60 días según el modelo; se reactiva volviendo al paso 3. Es una
> limitación de Samsung, no del paquete.

### 6. Comprobar en el televisor

- El icono aparece en Apps y abre a pantalla completa, sin barra del navegador.
- Las flechas mueven el foco y OK entra.
- **Atrás en la pantalla de inicio cierra la app** y vuelve al menú del
  televisor (esto es `salirDeLaApp()`, y Samsung lo exige para publicar).
- El botón ⏯ del mando pausa (esto es `registerKey` en `index.html`).
- Un canal arranca en menos de 5 segundos.

---

## TCL → depende del sistema que lleve, y hay que mirarlo

**TCL no es un sistema operativo, es una marca**, y vende televisores con tres
sistemas distintos. Antes de nada, míralo en el propio televisor:

| Qué ves al encenderla | Sistema | ¿Se puede instalar? |
|---|---|---|
| Fila de apps con el logo de Google, botón del Asistente | **Google TV / Android TV** | **Sí**, sigue abajo |
| Cuadrícula de mosaicos morados, mando con botón morado | **Roku TV** | **No** |
| Menú propio de TCL, sin Google Play | **Linux propio de TCL** | **No** |

En Ajustes → Sistema → Acerca de, si aparece «Versión de Android», es Android
TV. En Guatemala y Centroamérica la inmensa mayoría de los TCL son Google TV,
así que lo más probable es que estés en el primer caso.

> **Roku no admite aplicaciones web de ninguna forma.** Sus canales se escriben
> en BrightScript, y los canales privados desaparecieron en 2023. Si tu TCL es
> Roku, la vía es el navegador… que Roku tampoco tiene. Ahí la salida realista
> es un Chromecast con Google TV o un Fire TV Stick enchufado al HDMI: en los
> dos se instala el mismo APK de abajo.

### Android TV / Google TV → archivo `.apk`

#### 1. Comprobar la dirección

En `empaque/android/app/src/main/res/values/strings.xml`, ya con la del
despliegue actual:

```xml
<string name="url_app" translatable="false">https://canal-sable.vercel.app/</string>
```

#### 2. Conseguir el APK — dos caminos

**Camino corto (sin instalar nada):** en GitHub, pestaña **Actions** →
*APK para Android TV* → **Run workflow**. Puedes escribir ahí la dirección y no
tocar el repositorio. Al terminar, el APK se descarga del apartado *Artifacts*.

**Camino local:** hace falta Java 17 y el SDK de Android (con Android Studio
viene todo).

```bash
cd empaque/android
gradle wrapper          # solo la primera vez
./gradlew assembleDebug
```

Sale en `app/build/outputs/apk/debug/app-debug.apk`.

> Es un APK de **debug**, y está bien: va firmado con la clave de depuración de
> Android, así que se instala. Un APK de *release* sin firmar **no se instala
> en ningún sitio**, que es el error más habitual al intentar el atajo.

#### 3. Modo desarrollador en el televisor

1. **Ajustes → Sistema → Acerca de**.
2. Pulsa **7 veces** sobre «Compilación» (o «Build»). Sale «Ya eres
   desarrollador».
3. **Ajustes → Sistema → Opciones de desarrollador → Depuración por USB: ON**.
4. Apunta la IP: **Ajustes → Red → Estado**.

#### 4. Instalar

```bash
adb connect 192.168.1.XX:5555     # la IP del televisor
# En la tele sale un aviso de autorización: acéptalo con el mando
adb install -r app-debug.apk
```

`-r` reinstala encima si ya estaba. Si dice `INSTALL_FAILED_VERSION_DOWNGRADE`,
sube el `versionCode` en `app/build.gradle.kts`.

**Sin PC:** instala *Downloader* (de AFTVnews) desde Google Play en el
televisor, sube el APK a cualquier sitio con enlace directo, y ábrelo desde
ahí. Hay que permitir «Instalar apps desconocidas» para Downloader.

#### 5. Comprobar en el televisor

- **La app aparece en la fila de aplicaciones.** Si se instaló pero no la ves,
  falta `LEANBACK_LAUNCHER` en el manifiesto — pero ya está puesto.
- Se ve el **banner** ancho, no un cuadro gris.
- El mando mueve el foco y OK entra.
- **Atrás en Inicio cierra la app** (es el puente `CanalCasaAndroid`).
- Cierra la app, vuelve a abrirla: **los favoritos siguen ahí**. Si se
  perdieron, falta `domStorageEnabled`.
- Deja una película 20 minutos sin tocar el mando: **no debe entrar el
  salvapantallas** (es `FLAG_KEEP_SCREEN_ON`).

---

## Publicar en la tienda de Samsung: lo que va a pasar

Esto es distinto de instalarla en tu casa, y conviene saberlo antes de invertir
las horas.

Para publicar hay que registrarse en [Samsung Seller
Office](https://seller.samsungapps.com), subir el `.wgt` firmado con un
certificado de distribución **público** (no el del DUID de tu tele), aportar
capturas a 1920×1080 y pasar una revisión manual.

**La revisión va a pedir los derechos del contenido.** CanalCasa reproduce una
lista M3U de canales de televisión y películas de TMDB a través de servidores
como VidSrc, Vidlink o Multiembed, que son sitios de terceros sin licencia
sobre lo que sirven. Samsung rechaza las aplicaciones que emiten contenido sin
acreditar derechos: es un motivo de rechazo explícito en sus políticas, y lo
aplican. Distribuir públicamente una aplicación así también te expone a
reclamaciones de los titulares, que en la práctica llegan al desarrollador y no
a la tienda.

Dicho eso, y sin rodeos, las tres vías reales según lo que quieras:

1. **Para tus televisores y los de tu familia** — el modo desarrollador de
   arriba. Es legalmente otra cosa (uso doméstico, no distribución) y es lo que
   los pasos de este documento cubren de verdad. Renovar cada 30-60 días es el
   único inconveniente.
2. **Para publicarla de verdad** — hay que cambiar de qué se alimenta:
   `M3U_URL` apuntando a una lista que tengas licenciada o que sea tuya, y Cine
   y series apuntando a proveedores con derechos (`NEXT_PUBLIC_EMBED_PROVIDER_*`
   ya existe justo para eso). La aplicación no hay que tocarla; lo que cambia es
   el contenido. Con eso la revisión es un trámite normal.
3. **Samsung B2B / Partner** — si es para un hotel, un negocio o un despliegue
   cerrado, existe un canal de distribución que no pasa por la tienda pública.

Para Google Play (Android TV) el análisis es idéntico: mismas políticas de
contenido, misma conclusión.

---

## Qué toca cuando cambies algo

| Cambias… | ¿Hay que reempaquetar? |
|---|---|
| Código de la aplicación (`src/`) | **No.** Publicas en Vercel y ya está en las teles |
| Diseño, canales, catálogo | **No** |
| La dirección donde vive la app | **Sí**, los dos paquetes |
| El icono o el nombre | **Sí**, el paquete que corresponda |
| Teclas del mando (`TECLAS_A_REGISTRAR`) | **Sí** el de Tizen: la lista está también en `empaque/tizen/index.html` |

Esa última fila es la única duplicación a mano que queda entre la aplicación y
los paquetes, y está donde está porque `registerKey` solo se puede llamar desde
una página local del widget. Si tocas una, toca la otra.
