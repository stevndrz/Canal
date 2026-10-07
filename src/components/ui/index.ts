/**
 * Las primitivas de interfaz de CanalCasa. Sus estilos viven en
 * `src/app/ui.css` (sin capa) y solo usan los tokens de `shell.css`.
 * Todas se ven juntas, en todos sus estados, en `/sistema`.
 */
export { Boton, BotonIcono, type BotonProps, type VarianteBoton } from "./boton";
export { Chip, type ChipProps } from "./chip";
export { Segmentado, type OpcionSegmentado } from "./segmentado";
export { Interruptor } from "./interruptor";
export { Campo, CampoBusqueda } from "./campo";
export { EncabezadoSeccion } from "./encabezado-seccion";
export { Aviso, type TonoAviso } from "./aviso";
export { EstadoVacio } from "./estado-vacio";
export { PantallaMensaje } from "./pantalla-mensaje";
export { ContenedorVista } from "./contenedor-vista";
export { Confirmacion } from "./confirmacion";
export type { Tamano } from "./clases";
