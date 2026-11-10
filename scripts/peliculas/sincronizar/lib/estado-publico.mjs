import { ESTADO } from "./nube.mjs";
import { crearLectorDeProgreso } from "./progreso.mjs";

/**
 * El estado del PC, a la vista desde el teléfono.
 *
 * Mientras sincroniza, el PC deja en el bucket un `peliculas/estado.json`
 * pequeño —qué está convirtiendo o subiendo y su porcentaje, cuánto ocupa la
 * nube, cuándo fue la última vuelta— y la app lo lee igual que lee el
 * catálogo. Así se sabe sin ir al PC si la película ya casi está.
 *
 * Dos reglas:
 *   - **Es público** (como el catálogo): solo lleva el título, números y
 *     horas. Nunca rutas del PC ni el texto de un error.
 *   - **Nunca rompe la sincronización**: si no se pudo escribir, se apunta en
 *     el registro y se sigue. Es un adorno, no un paso.
 */

export { ESTADO };
/** Con el porcentaje quieto, cada cuánto se repite al menos (para que se vea que sigue vivo). */
const CADA_MS = 60_000;
/** Cuántos puntos tiene que avanzar para volver a escribir. */
const PASO = 5;

export function crearEstadoPublico({ nube, limite, automatica = false, registrar = () => {}, ahora = () => Date.now() }) {
  let haciendo = null;
  let publicado = { clave: "", porcentaje: -100, cuando: 0 };
  let enVuelo = null;
  let usado = null;

  const escribir = async (extra = {}) => {
    const estado = {
      version: 1,
      actualizado: new Date(ahora()).toISOString(),
      automatica,
      haciendo,
      usado,
      limite,
      pendientes: 0,
      fallo: false,
      ...extra,
    };
    try {
      await nube.escribirEstado(estado);
    } catch (error) {
      registrar(`No pude publicar el estado del PC: ${error instanceof Error ? error.message : error}`);
    }
  };

  /** De una en una: con una escritura en marcha, la siguiente se salta (ya vendrá otra). */
  const intentar = () => {
    if (enVuelo) return;
    const clave = haciendo ? `${haciendo.fase}|${haciendo.titulo}` : "";
    const p = haciendo?.porcentaje ?? 0;
    const cambio = clave !== publicado.clave || p >= publicado.porcentaje + PASO || ahora() - publicado.cuando >= CADA_MS;
    if (!cambio) return;
    publicado = { clave, porcentaje: p, cuando: ahora() };
    enVuelo = escribir().finally(() => (enVuelo = null));
  };

  const lector = crearLectorDeProgreso((p) => {
    haciendo = p ? { fase: p.fase, titulo: String(p.titulo ?? "").slice(0, 120), porcentaje: p.porcentaje } : null;
    // El final de una fase no se publica suelto: lo dice `fin`, o la fase siguiente.
    if (haciendo) intentar();
  });

  return {
    /** Lo que avisa el motor al empezar cada fase (`opciones.alProgreso`). */
    fase: (info) => lector.fase(info),
    /** La salida de ffmpeg y rclone, tal cual llega. */
    leer: (trozo) => lector.leer(trozo),
    /** Al terminar la vuelta, bien o mal: nada en marcha, y lo que ocupa la nube. */
    async fin({ pendientes = 0, fallo = false } = {}) {
      await enVuelo;
      haciendo = null;
      try {
        usado = await nube.tamanoTotal();
      } catch {
        usado = null;
      }
      await escribir({ pendientes, fallo });
    },
  };
}
