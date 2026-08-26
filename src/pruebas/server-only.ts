/**
 * Relleno de `server-only` para las pruebas.
 *
 * El paquete real lanza al importarse fuera del servidor, que es exactamente
 * lo que se quiere en producción: la fuga se convierte en error de
 * compilación. En Vitest no hay navegador y ese error impediría probar los
 * módulos que viven detrás de esa frontera. Ver el alias en `vitest.config.ts`.
 */
export {};
