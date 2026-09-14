/*
 * Los complementos se declaran aquí sin aplicarlos (`apply false`) y se aplican
 * en `app/`. Es la forma en que Gradle resuelve una sola versión para todo el
 * proyecto en vez de que cada módulo traiga la suya.
 */
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}
