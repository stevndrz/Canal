/**
 * El avance de ffmpeg y rclone, leído de lo que escriben en pantalla.
 *
 *   ffmpeg -stats:     «… time=00:12:34.56 bitrate=…»  → contra la duración
 *   rclone --progress: «Transferred:  1.2 GiB / 3.4 GiB, 35%, …»
 *
 * `alAvance` recibe { fase, titulo, porcentaje } cada vez que cambia el
 * porcentaje entero (no en cada línea: ffmpeg escribe muchas por segundo).
 */
export function crearLectorDeProgreso(alAvance) {
  let actual = null;
  let ultimo = -1;
  let resto = "";

  const emitir = (porcentaje) => {
    const p = Math.max(0, Math.min(100, Math.floor(porcentaje)));
    if (!actual || p === ultimo) return;
    ultimo = p;
    alAvance({ fase: actual.fase, titulo: actual.titulo, porcentaje: p });
  };

  return {
    /** Lo que avisa `sincronizar` al empezar cada fase (o null al acabar). */
    fase(info) {
      actual = info;
      ultimo = -1;
      resto = "";
      alAvance(info ? { fase: info.fase, titulo: info.titulo, porcentaje: info.fase === "convertir" && !info.duracion ? null : 0 } : null);
    },
    /** Un trozo de salida, tal cual llega. */
    leer(trozo) {
      if (!actual) return;
      const texto = resto + String(trozo);
      // ffmpeg separa con \r; rclone, con \n o borrando la pantalla.
      const lineas = texto.split(/[\r\n]+/);
      resto = lineas.pop() ?? "";
      for (const l of [...lineas, resto]) {
        if (actual.fase === "convertir") {
          const m = /time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(l);
          if (m && actual.duracion > 0) emitir(((+m[1] * 3600 + +m[2] * 60 + +m[3]) / actual.duracion) * 100);
        } else {
          const m = /Transferred:[^\n]*?,\s*(\d{1,3})%/.exec(l);
          if (m) emitir(+m[1]);
        }
      }
    },
  };
}
