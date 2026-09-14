/*
 * CanalCasa para Android TV / Google TV (televisores TCL, Hisense, Chromecast,
 * Fire TV con alguna vuelta más).
 *
 * Igual que el paquete de Tizen, esto NO empaqueta la aplicación: la
 * aplicación vive en el servidor. Esto es la cáscara que la abre a pantalla
 * completa, con su icono en la fila de aplicaciones del televisor y con el
 * mando funcionando como se espera.
 *
 * Todo lo que hay que cambiar antes de compilar está en
 * `app/src/main/res/values/strings.xml` (la dirección de la app).
 */
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "CanalCasa"
include(":app")
