/**
 * Fuentes oficiales que mandan sobre la lista M3U.
 *
 * La lista pública (iptv-org y la copia del gist) apunta Canal 3, Canal 7 y
 * TN23 a unas distribuciones de CloudFront (`…/ts:abr.m3u8`) que Chapin TV ya
 * no usa como principales: devuelven 403 «configured to block access from your
 * country» fuera de Guatemala y, la de Canal 3, ni siquiera sale ya en su web.
 * La web oficial (chapintv.com/envivo-canal-N, campo `streamUrl` de la página)
 * reproduce hoy una URL distinta, sin firma ni token, con CORS abierto.
 *
 * Se indexa por `tvg-id` y no por nombre: «Canal 3» hay en cinco países.
 *
 * Si un canal deja de verse, lo primero es comparar estas URLs con el
 * `streamUrl` de su página en chapintv.com (lo hace `scripts/revisar-fuentes.mjs`).
 */

interface FuenteOficial {
  principal: string;
  respaldo: string;
}

/** Principal: el master con *content steering*. Respaldo: la otra distribución. */
function deChapinTv(id: string): FuenteOficial {
  return {
    principal: `https://ddycmnicl95kp.cloudfront.net/live/${id}/master.m3u8`,
    respaldo: `https://d6qmllupbc5d2.cloudfront.net/hls/${id}/index.m3u8`,
  };
}

/** Clave: el `tvg-id` sin la parte de `@SD`/`@HD`, en minúsculas. */
export const FUENTES_OFICIALES: Readonly<Record<string, FuenteOficial>> = {
  "canal3.gt": deChapinTv("i8bocdjcqa5r"),
  "canal7.gt": deChapinTv("hm8maie2jnn2"),
  "tn23.gt": deChapinTv("by1ualyjwslr"),
};

export function fuenteOficial(tvgId: string): FuenteOficial | undefined {
  const clave = tvgId.split("@")[0].trim().toLowerCase();
  return clave ? FUENTES_OFICIALES[clave] : undefined;
}

/**
 * Canal 3 y Canal 7 emiten en SD, 720×480, pero la imagen es 16:9 apretada en
 * ese cuadro y marcada como píxel cuadrado (SAR 1:1, es decir, 3:2). El
 * navegador la pinta tal cual y la gente sale delgada: el «7» del logo se ve
 * ovalado. TN23 ya emite 1280×720 y no lo necesita.
 *
 * Medido con ffprobe sobre un segmento de cada una (2026-11-12).
 */
const ANAMORFICAS = ["i8bocdjcqa5r", "hm8maie2jnn2"];

/** Cuánto hay que ensanchar 3:2 para que sea 16:9: (16/9) / (3/2) = 32/27. */
export const ENSANCHE_ANAMORFICO = 32 / 27;

/**
 * El factor por el que ensanchar la imagen, o 1 si se deja como viene.
 *
 * Pide las dos cosas: que la URL sea de una de esas señales y que la imagen
 * mida de verdad 3:2. Si Chapin TV pasa a emitir en 720p, deja de aplicarse
 * sola, sin tocar nada aquí.
 */
export function ensancheDeImagen(url: string, ancho?: number, alto?: number): number {
  if (!ancho || !alto || Math.abs(ancho / alto - 1.5) > 0.01) return 1;
  return ANAMORFICAS.some((id) => url.includes(`/${id}/`)) ? ENSANCHE_ANAMORFICO : 1;
}
