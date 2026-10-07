import type { Channel } from "@/lib/types";
import { nombreDePais, paisDe, regionDe, NOMBRE_DE_REGION } from "@/lib/origenes";

/**
 * Qué contar de un canal cuando no hay guía de programación.
 *
 * La inmensa mayoría de listas M3U públicas no traen EPG, así que el panel de
 * detalle se quedaba con un «Este canal no tiene guía de programación» y nada
 * más: una columna alta y vacía junto a la lista.
 *
 * Todo lo que sale de aquí se **deriva de lo que ya está en el cliente**. Cero
 * peticiones y cero bytes añadidos a los canales que viajan, que es la
 * restricción que gobierna todo este proyecto: un campo nuevo en `Channel`
 * viaja una vez por canal.
 */

/**
 * De qué va cada tema, en una frase. `category` llega con el tema desde
 * `desempaquetarCanales` (ver `temas.ts`); antes eran las categorías viejas, y
 * la mitad de la lista se describía como «Señal de otro país, en su idioma
 * original», que es decir que no se sabe.
 */
const QUE_ES: Record<string, string> = {
  Generalista: "Programación de todo un poco: informativos, novelas, deportes y entretenimiento.",
  Noticias: "Informativos y actualidad durante todo el día.",
  Deportes: "Competiciones en directo, resúmenes y programas de análisis.",
  Infantil: "Dibujos animados y programación para niñas y niños.",
  "Películas y series": "Cine y series emitidas en continuo, sin catálogo a la carta.",
  Variedades: "Concursos, magacines, cocina, viajes y programas de entretenimiento.",
  Documentales: "Naturaleza, historia, ciencia y reportajes de larga duración.",
  Música: "Vídeos musicales y conciertos.",
  Religión: "Programación de contenido religioso.",
  Institucional: "Canal público o legislativo: sesiones, avisos oficiales y cultura.",
  Compras: "Televenta: productos y ofertas en directo.",
  Otros: "Programación variada, sin una temática fija.",
};

/** Lo de casa se cuenta como de casa. */
const QUE_ES_DE_GUATEMALA: Record<string, string> = {
  Generalista: "Señal nacional guatemalteca: noticias, revistas y producción local.",
  Noticias: "Informativos de Guatemala y de la región, durante todo el día.",
};

export interface DatosCanal {
  /** Una frase sobre qué se ve en este canal. */
  descripcion: string;
  /** Pares dato/valor para la ficha, ya filtrados: nunca vacíos. */
  datos: { termino: string; valor: string }[];
}

export function describirCanal(canal: Channel): DatosCanal {
  const pais = paisDe(canal);
  const datos: { termino: string; valor: string }[] = [];

  // Número, país y tema ya van en la línea de debajo del nombre; aquí solo lo
  // que añade algo. Fuera «Formato: HLS» (lo era el 99,6 % de la lista) y la
  // «Calidad» leída del nombre, que acertaba en 4 canales de 4.816 y por el
  // nombre, no por la señal.
  const region = regionDe(canal);
  if (pais && region !== "guatemala" && region !== "mundo" && NOMBRE_DE_REGION[region] !== nombreDePais(pais)) {
    datos.push({ termino: "Región", valor: NOMBRE_DE_REGION[region] });
  }
  if (canal.streamUrlBackup) {
    datos.push({ termino: "Señal", valor: "Con una segunda fuente si la primera falla" });
  }

  return {
    descripcion:
      (pais === "gt" ? QUE_ES_DE_GUATEMALA[canal.category] : undefined) ??
      QUE_ES[canal.category] ??
      QUE_ES.Otros,
    datos,
  };
}
