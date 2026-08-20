/**
 * Enlaces magnet: qué se puede sacar de ellos sin un cliente BitTorrent.
 *
 * Un magnet no contiene el vídeo. Es una etiqueta con el hash de un archivo y
 * una lista de sitios donde preguntar por él. Para reproducirlo de verdad hace
 * falta hablar BitTorrent con otros pares, y eso un navegador **no puede
 * hacerlo**: los clientes normales (qBittorrent, Transmission) hablan TCP y
 * uTP, y desde una pestaña solo se puede abrir WebRTC. Los dos mundos no se
 * ven entre sí salvo que alguien esté sembrando con un cliente que hable los
 * dos, que en la práctica casi nunca ocurre.
 *
 * Con una excepción que sí sirve, y es la razón de que este archivo exista: el
 * parámetro `ws` (*web seed*, definido en BEP 19) es una URL HTTP normal del
 * mismo archivo. Cuando un magnet la trae, no hace falta BitTorrent para nada
 * — se reproduce esa URL y ya está. Este módulo extrae esa URL cuando existe y
 * dice claramente que no cuando no.
 *
 * Por eso aquí no se importa ningún cliente de torrents. Añadir WebTorrent son
 * ~600 KB de JavaScript que pagaría **todo el mundo** en cada carga para un
 * caso que, sin web seed, seguiría sin funcionar.
 */

/** Lo que se puede leer de un magnet sin salir a la red. */
export interface MagnetLeido {
  /** El hash del contenido (`xt=urn:btih:…`), en minúsculas. */
  infohash: string;
  /** Nombre sugerido (`dn=`), si lo trae. */
  nombre: string;
  /** Rastreadores anunciados (`tr=`). Se guardan por diagnóstico. */
  rastreadores: string[];
  /**
   * Réplicas HTTP del archivo (`ws=`, y también `as=` que es su variante
   * antigua). Si hay alguna, el enlace es reproducible hoy y sin torrents.
   */
  replicasHttp: string[];
}

/** ¿Este texto es un enlace magnet? */
export function esMagnet(texto: string): boolean {
  return texto.trim().toLowerCase().startsWith("magnet:?");
}

/**
 * Lee un magnet, o devuelve `null` si no lo es o no trae infohash.
 *
 * El infohash se acepta en las dos formas que define BEP 9: 40 caracteres
 * hexadecimales (SHA-1) o 32 en base32, que es como los escriben algunos
 * sitios. Se normaliza a minúsculas para poder compararlos.
 */
export function leerMagnet(texto: string): MagnetLeido | null {
  if (!esMagnet(texto)) return null;

  let params: URLSearchParams;
  try {
    // `magnet:?x=y` no es una URL jerárquica, así que `new URL()` no da un
    // `searchParams` utilizable en todos los motores. Se parte a mano.
    params = new URLSearchParams(texto.trim().slice("magnet:?".length));
  } catch {
    return null;
  }

  const infohash = params
    .getAll("xt")
    .map((xt) => /^urn:btih:([0-9a-f]{40}|[a-z2-7]{32})$/i.exec(xt.trim())?.[1])
    .find(Boolean);

  if (!infohash) return null;

  return {
    infohash: infohash.toLowerCase(),
    nombre: params.get("dn")?.trim() ?? "",
    rastreadores: params.getAll("tr").filter(Boolean),
    // `as` (acceptable source) es la forma antigua de lo mismo. Se aceptan las
    // dos y se quedan solo las que de verdad se pueden pedir por HTTP.
    replicasHttp: [...params.getAll("ws"), ...params.getAll("as")]
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u)),
  };
}

/**
 * La URL que sí se puede reproducir, o `null` si este magnet no trae ninguna.
 *
 * `null` no es un fallo del programa: es la respuesta correcta para la inmensa
 * mayoría de los magnet que circulan. Quien llama debe explicarlo, no
 * reintentar.
 */
export function fuenteReproducible(magnet: MagnetLeido): string | null {
  return magnet.replicasHttp[0] ?? null;
}

/**
 * Qué decirle a la persona que acaba de pegar un magnet.
 *
 * Se explica el motivo, no solo el resultado: sin el porqué, «no se puede»
 * parece un capricho de la aplicación y se intenta otras cinco veces.
 */
export function avisoDeMagnet(magnet: MagnetLeido): string {
  if (fuenteReproducible(magnet)) {
    return "Este magnet trae una copia por HTTP (web seed) y se reproduce directamente, sin descargar el torrent.";
  }
  return (
    "Un magnet no lleva el vídeo dentro: lleva su huella y una lista de dónde buscarlo, " +
    "y para pedirlo hay que hablar BitTorrent con otros ordenadores. Un navegador no puede " +
    "hacerlo. Lo que sí funciona: abrirlo en una aplicación de torrents y, cuando termine, " +
    "pegar aquí el archivo .mp4 resultante."
  );
}
