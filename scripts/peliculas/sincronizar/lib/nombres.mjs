/**
 * Nombres: de lo que se llama el archivo a lo que se ve en la app.
 *
 * Las descargas traen nombres como
 * «The.Hunger.Games.Catching.Fire.2013.1080p.BluRay.x264-SPARKS.mkv». Antes
 * había que renombrar a «pelicula.mkv» y escribir el título a mano; ahora el
 * título sale del nombre, quitando lo técnico, y si se quiere otro basta con
 * renombrar el archivo o su carpeta.
 */

/** Etiquetas técnicas: a partir de la primera, lo demás sobra. */
const RUIDO = new RegExp(
  "^(" +
    [
      "\\d{3,4}p", "4k", "uhd", "hdr10?\\+?", "dv", "dovi", "sdr", "10bit", "8bit",
      "bluray", "blu-ray", "bdrip", "brrip", "bdremux", "remux", "web-?dl", "webrip", "web", "hdtv", "dvdrip", "hdrip",
      "x26[45]", "h\\.?26[45]", "hevc", "avc", "xvid", "av1",
      "aac\\d?(\\.\\d)?", "ac3", "eac3", "ddp?\\d?(\\.\\d)?", "dts(-hd)?", "truehd", "atmos", "flac", "\\d\\.\\d",
      "dual", "multi", "latino", "castellano", "spanish", "english", "subs?", "subbed",
      "proper", "repack", "extended", "unrated", "imax", "remastered",
      "amzn", "nf", "dsnp", "hmax", "atvp", "yts", "yify", "rarbg",
    ].join("|") +
    ")$",
  "i",
);

/**
 * «The.Hunger.Games.Catching.Fire.2013.1080p.BluRay.x264-SPARKS» →
 * { titulo: "The Hunger Games Catching Fire", anio: 2013 }.
 */
export function tituloDelNombre(nombre) {
  let base = nombre.replace(/\.[a-z0-9]{2,4}$/i, "");
  // Lo que va entre corchetes casi siempre es del grupo que lo subió.
  base = base.replace(/\[[^\]]*\]/g, " ");
  // «Película (2013)»: el año entre paréntesis se aparta.
  let anio = null;
  base = base.replace(/\((19\d{2}|20\d{2})\)/, (_, a) => {
    anio = Number(a);
    return " ";
  });
  const palabras = base.split(/[\s._]+/).filter(Boolean);
  const titulo = [];
  for (let i = 0; i < palabras.length; i++) {
    const p = palabras[i].replace(/-[A-Za-z0-9]+$/, (sufijo) => (i === palabras.length - 1 && i > 0 ? "" : sufijo));
    // Un año suelto marca el final del título (salvo que sea lo primero:
    // «2012» es una película).
    if (/^(19\d{2}|20\d{2})$/.test(p) && titulo.length > 0) {
      anio ??= Number(p);
      break;
    }
    if (RUIDO.test(p) && titulo.length > 0) break;
    titulo.push(p);
  }
  const limpio = titulo.join(" ").replace(/\s+-\s*$/, "").replace(/\s+/g, " ").trim();
  return { titulo: limpio || nombre, anio };
}

/** Para carpetas y URLs: sin acentos ni espacios. */
export function slug(texto) {
  const limpio = texto
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpio || "pelicula";
}

const IDIOMAS = {
  spa: "Español", eng: "Inglés", por: "Portugués", fra: "Francés", ita: "Italiano",
  deu: "Alemán", jpn: "Japonés", kor: "Coreano", zho: "Chino",
};
const ALIAS_IDIOMA = {
  es: "spa", spa: "spa", esp: "spa", spanish: "spa", espanol: "spa", español: "spa",
  latino: "spa", lat: "spa", castellano: "spa", cast: "spa",
  en: "eng", eng: "eng", english: "eng", ingles: "eng", inglés: "eng",
  pt: "por", por: "por", portuguese: "por", fr: "fra", fra: "fra", fre: "fra", french: "fra",
  it: "ita", ita: "ita", de: "deu", deu: "deu", ger: "deu", ja: "jpn", jpn: "jpn", ko: "kor", kor: "kor",
  zh: "zho", zho: "zho", chi: "zho",
};
const CORTO = { spa: "es", eng: "en", por: "pt", fra: "fr", ita: "it", deu: "de", jpn: "ja", kor: "ko", zho: "zh" };

export function normalizarIdioma(codigo) {
  if (!codigo) return "";
  const base = String(codigo).toLowerCase().split(/[-_]/)[0];
  return ALIAS_IDIOMA[base] ?? base;
}

export function nombreDeIdioma(codigo) {
  return IDIOMAS[normalizarIdioma(codigo)] ?? codigo ?? "";
}

export function idiomaCorto(codigo) {
  const n = normalizarIdioma(codigo);
  return CORTO[n] ?? (n.length === 2 ? n : "und");
}

/**
 * Qué subtítulo es por su nombre: «Catching.Fire.2013.Spanish.Latino.srt»,
 * «pelicula.es.forced.srt», «English [SDH].srt». Sin idioma reconocible, se
 * da por español (es lo que se suele descargar a mano para esta casa).
 */
export function infoSubtitulo(nombre) {
  const sinExt = nombre.replace(/\.[a-z0-9]{2,4}$/i, "").toLowerCase();
  const fichas = sinExt.split(/[\s._\-[\]()]+/).filter(Boolean);
  let idioma = "";
  // De atrás adelante: el idioma suele ir al final («…2013.es.srt»).
  for (let i = fichas.length - 1; i >= 0 && !idioma; i--) {
    const f = fichas[i];
    if (ALIAS_IDIOMA[f]) idioma = ALIAS_IDIOMA[f];
  }
  const forzados = fichas.some((f) => /^(forced|forzados?|forzado)$/.test(f));
  const sordos = fichas.some((f) => /^(sdh|cc|hi)$/.test(f));
  const latino = fichas.some((f) => /^(latino|lat|latam)$/.test(f));
  idioma ||= "spa";
  let etiqueta = IDIOMAS[idioma] ?? idioma;
  if (latino && idioma === "spa") etiqueta = "Español latino";
  if (forzados) etiqueta += " (forzados)";
  if (sordos) etiqueta += " (SDH)";
  return { idioma, srclang: idiomaCorto(idioma), etiqueta, forzados };
}
