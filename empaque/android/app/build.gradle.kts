plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "casa.canalcasa.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "casa.canalcasa.tv"

        /**
         * `minSdk = 21` es Android 5, que es donde empieza Android TV. Casi
         * ningún televisor con Google TV baja de Android 9, pero subirlo no
         * gana nada aquí: la cáscara son cuatro llamadas a WebView que existen
         * desde siempre.
         */
        minSdk = 21
        targetSdk = 35

        /**
         * Al actualizar hay que SUBIR `versionCode`: Android se niega a
         * instalar encima un APK con un número igual o menor, y el error que
         * enseña el televisor ("no se pudo instalar la aplicación") no dice
         * cuál es el motivo.
         */
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            /**
             * Sin ofuscar y sin recortar recursos, a propósito: aquí no hay
             * lógica que proteger —son 150 líneas que abren una WebView— y
             * R8 solo añadiría una forma más de que el APK de release se
             * comporte distinto del de debug.
             */
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    /**
     * Una sola dependencia, y es la de la tecla Atrás.
     *
     * `androidx.activity` trae `onBackPressedDispatcher`, que es la forma
     * soportada de interceptar Atrás desde Android 13 — `onBackPressed()`
     * quedó obsoleto y en los televisores nuevos deja de llamarse.
     */
    implementation("androidx.activity:activity:1.9.3")
}
