# CanalCasa para Android TV / Google TV

La cáscara que abre CanalCasa a pantalla completa en un televisor con Android
(TCL, Hisense, Sony, Philips, un Chromecast con Google TV, un Fire TV…).

**No lleva la aplicación dentro**: la aplicación vive en el servidor y esto la
abre. El porqué, y el procedimiento completo con el modo desarrollador de la
tele, está en [`docs/EMPAQUETADO.md`](../../docs/EMPAQUETADO.md).

## Compilar

```bash
cd empaque/android
gradle wrapper        # solo la primera vez, genera ./gradlew
./gradlew assembleDebug
```

Sale en `app/build/outputs/apk/debug/app-debug.apk`.

O sin instalar nada: GitHub → **Actions** → *APK para Android TV* → *Run
workflow*, y el APK se descarga de *Artifacts*.

## Dónde está cada cosa

| Archivo | Qué decide |
|---|---|
| `app/src/main/res/values/strings.xml` | **La dirección de la app.** Es lo único que se cambia normalmente |
| `app/src/main/java/.../MainActivity.kt` | Los ajustes de la WebView, la tecla Atrás y el puente para salir |
| `app/src/main/AndroidManifest.xml` | Lo que hace que la app APAREZCA en el menú del televisor |
| `app/build.gradle.kts` | `versionCode`, que hay que **subir** en cada actualización |

## El icono, que tiene truco

`res/mipmap-xxxhdpi/ic_launcher.png` es una copia de `public/icono-192.png`
(192×192 es exactamente la medida de xxxhdpi, no hay que reescalar nada). Es el
respaldo para Android 7 y anteriores: los iconos adaptativos de
`res/mipmap-anydpi-v26/` existen solo desde Android 8, y sin este PNG el APK no
instala con `minSdk 21`.

Si cambia el icono de la web:

```bash
cp public/icono-192.png empaque/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
```

> Y una regla que cuesta un build entero descubrir: **dentro de `res/` no puede
> haber ningún archivo que no sea `.xml` o `.png`**. Ni un `.txt`, ni un
> `.gitkeep`. El compilador de recursos falla con
> «The file name must end with .xml or .png». Por eso esta nota está aquí y no
> junto al icono, que es donde se leería mejor.
