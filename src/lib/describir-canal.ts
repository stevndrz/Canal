import type { Channel } from "@/lib/types";

/**
 * Qué contar de un canal cuando no hay guía de programación.
 *
 * La inmensa mayoría de listas M3U públicas no traen EPG, así que el panel de
 * detalle se quedaba con un «Este canal no tiene guía de programación» y nada
 * más: una columna alta y vacía junto a la lista.
 *
 * Todo lo que sale de aquí se **deriva de lo que ya está en el cliente**. Cero
 * peticiones y cero bytes añadidos a los 7.822 canales que viajan en el HTML,
 * que es la restricción que gobierna todo este proyecto: un campo nuevo en
 * `Channel` son 230 KB más que descargar e interpretar.
 */

/** De qué va cada categoría, en una frase. */
const QUE_ES: Record<string, string> = {
  Guatemala: "Señal nacional guatemalteca: noticias, revistas y producción local.",
  Deportes: "Competiciones en directo, resúmenes y programas de análisis.",
  Noticias: "Informativos y actualidad durante todo el día.",
  "Películas y series": "Cine y series emitidas en continuo, sin catálogo a la carta.",
  Documentales: "Naturaleza, historia, ciencia y reportajes de larga duración.",
  Infantil: "Dibujos animados y programación para niñas y niños.",
  Música: "Vídeos musicales y conciertos.",
  Religión: "Programación de contenido religioso.",
  Entretenimiento: "Concursos, magacines y programas de variedades.",
  Español: "Emisión en español, de fuera de Guatemala.",
  Inglés: "Emisión en inglés.",
  Internacional: "Señal de otro país, en su idioma original.",
  General: "Programación variada, sin una temática fija.",
};

export interface DatosCanal {
  /** Una frase sobre qué se ve en este canal. */
  descripcion: string;
  /** Pares dato/valor para la ficha, ya filtrados: nunca vacíos. */
  datos: { termino: string; valor: string }[];
}

export function describirCanal(canal: Channel): DatosCanal {
  const datos: { termino: string; valor: string }[] = [
    { termino: "Número", valor: canal.number },
    { termino: "Categoría", valor: canal.category },
  ];

  const calidad = calidadDeNombre(canal.name);
  if (calidad) datos.push({ termino: "Calidad", valor: calidad });

  const formato = formatoDeUrl(canal.streamUrl);
  if (formato) datos.push({ termino: "Formato", valor: formato });

  return {
    descripcion: QUE_ES[canal.category] ?? QUE_ES.General,
    datos,
  };
}

/**
 * La calidad que el canal declara en su propio nombre.
 *
 * Es lo único que se sabe con certeza antes de reproducir: la resolución real
 * solo se conoce cuando hls.js lee la lista de pistas, y para entonces ya no
 * estamos en este panel. Se lee del nombre y se dice tal cual, sin prometer.
 */
function calidadDeNombre(nombre: string): string | null {
  if (/\b(4k|uhd)\b/i.test(nombre)) return "4K declarado";
  if (/\bfhd\b/i.test(nombre)) return "Full HD declarado";
  if (/\bhd\b/i.test(nombre)) return "HD declarado";
  if (/\bsd\b/i.test(nombre)) return "Definición estándar";
  return null;
}

/** Cómo se transmite, en palabras y no en extensión de archivo. */
function formatoDeUrl(url: string): string | null {
  const limpia = url.toLowerCase().split("?")[0];
  if (/\.m3u8$/.test(limpia)) return "HLS (adaptativo)";
  if (/\.ts$/.test(limpia)) return "MPEG-TS";
  if (/\.flv$/.test(limpia)) return "FLV";
  return null;
}
