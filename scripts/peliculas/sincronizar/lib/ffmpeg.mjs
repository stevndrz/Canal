import { nombreDeIdioma, normalizarIdioma, idiomaCorto } from "./nombres.mjs";

/**
 * Cómo se convierte una película a HLS: lo mismo que hacía
 * `subir-pelicula.ps1`, probado ya con la primera película, pasado a funciones
 * puras. Lo que se lanza (ffmpeg/ffprobe) vive en `sincronizar.mjs`.
 *
 *   - Vídeo H.264 de 8 bits hasta 1080p: se COPIA (minutos).
 *   - H.265, 10 bits, 4K o HDR: se recodifica a H.264 High 4.1 (cualquier
 *     tele lo decodifica). Con la tarjeta NVIDIA, mucho más rápido.
 *   - Audio: AAC estéreo. Un 5.1 en AC3/DTS no suena en muchas teles.
 *   - Subtítulos de texto como .vtt aparte; los de imagen (PGS) no se pueden.
 */

const DE_TEXTO = new Set(["subrip", "ass", "ssa", "webvtt", "mov_text", "text"]);

function idiomaDe(pista) {
  const c = pista?.tags?.language?.toLowerCase() ?? "";
  return c === "und" ? "" : c;
}

export function nombreDePista(pista, porDefecto) {
  if (pista?.tags?.title?.trim()) return pista.tags.title.trim();
  const c = idiomaDe(pista);
  return c ? nombreDeIdioma(c) || c : porDefecto;
}

/** Lo que trae el archivo (salida JSON de ffprobe) y qué hay que hacer con él. */
export function analizar(sonda, { audioPrincipal = "spa" } = {}) {
  const streams = sonda?.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
  if (!video) throw new Error("El archivo no tiene vídeo.");
  const principal = normalizarIdioma(audioPrincipal);
  const audios = streams
    .filter((s) => s.codec_type === "audio")
    .sort((a, b) => {
      const pa = normalizarIdioma(idiomaDe(a)) === principal ? 0 : 1;
      const pb = normalizarIdioma(idiomaDe(b)) === principal ? 0 : 1;
      return pa - pb || a.index - b.index;
    });
  if (audios.length === 0) throw new Error("El archivo no tiene audio.");

  const hdr = ["smpte2084", "arib-std-b67"].includes(video.color_transfer);
  const nivel = Number(video.level) || 0;
  const ancho = Number(video.width) || 0;
  const motivos = [];
  if (video.codec_name !== "h264") motivos.push(video.codec_name);
  if (video.pix_fmt !== "yuv420p") motivos.push(video.pix_fmt);
  if (ancho > 1920) motivos.push("más de 1080p");
  if (nivel > 41) motivos.push(`nivel ${nivel}`);
  if (hdr) motivos.push("HDR");

  return {
    video,
    audios,
    subtitulos: streams.filter((s) => s.codec_type === "subtitle"),
    hdr,
    copiable: motivos.length === 0,
    motivos,
    duracion: Math.round(Number(sonda?.format?.duration) || 0),
    tituloInterno: sonda?.format?.tags?.title?.trim() || "",
  };
}

export function filtrosDeVideo(analisis, { hayZscale = true } = {}) {
  const filtros = [];
  if (analisis.hdr && hayZscale) {
    filtros.push("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p");
  }
  if (Number(analisis.video.width) > 1920) filtros.push("scale='min(1920,iw)':-2");
  return filtros;
}

/** Los modos de recodificar, del más rápido al de respaldo (la CPU, siempre al final). */
export function argumentosVideo(modo, { calidad = 24, filtros = [] } = {}) {
  if (modo === "copiar") return ["-c:v", "copy"];
  const f = filtros.length ? ["-vf", filtros.join(",")] : [];
  // Un fotograma clave cada 6 s: cada segmento empieza limpio y saltar es instantáneo.
  const claves = ["-force_key_frames", "expr:gte(t,n_forced*6)"];
  // Techo de bitrate: que una escena difícil no atasque el wifi de la tele.
  const tope = ["-maxrate", "6M", "-bufsize", "12M"];
  const q = String(calidad);
  const nvenc = ["-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr", "-cq", q, "-b:v", "0", "-profile:v", "high", "-level:v", "4.1", "-pix_fmt", "yuv420p", "-forced-idr", "1"];
  switch (modo) {
    case "nvidia":
      return [...f, ...nvenc, "-spatial-aq", "1", "-rc-lookahead", "20", ...tope, ...claves];
    case "nvidia-basico":
      return [...f, ...nvenc, ...tope, ...claves];
    case "intel":
      return [...f, "-c:v", "h264_qsv", "-preset", "medium", "-global_quality", q, "-profile:v", "high", "-level", "41", "-pix_fmt", "nv12", ...tope, ...claves];
    case "amd":
      return [...f, "-c:v", "h264_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", String(calidad - 1), "-qp_p", String(calidad + 1), "-profile:v", "high", "-level", "4.1", "-pix_fmt", "nv12", ...claves];
    default:
      return [...f, "-c:v", "libx264", "-preset", "medium", "-crf", q, "-profile:v", "high", "-level:v", "4.1", "-pix_fmt", "yuv420p", ...tope, ...claves];
  }
}

/**
 * Qué modos probar, en orden. `funciona(nombre)` dice si un codificador de
 * ffmpeg arranca en este PC (se prueba con un fotograma).
 */
export function modosAProbar(analisis, { aceleracion = "auto", recodificar = false, funciona = () => false } = {}) {
  if (analisis.copiable && !recodificar) return ["copiar"];
  const modos = [];
  if (aceleracion === "auto") {
    if (funciona("h264_nvenc")) modos.push("nvidia", "nvidia-basico");
    else if (funciona("h264_qsv")) modos.push("intel");
    else if (funciona("h264_amf")) modos.push("amd");
  } else if (aceleracion === "nvidia") modos.push("nvidia", "nvidia-basico");
  else if (aceleracion !== "cpu") modos.push(aceleracion);
  modos.push("cpu");
  return modos;
}

/** Los argumentos de ffmpeg para el HLS, con todos los audios elegibles. */
export function argumentosHls(analisis, argsVideo) {
  const mapa = ["-map", `0:${analisis.video.index}`];
  const flujos = ["v:0,agroup:aud,name:video"];
  analisis.audios.forEach((a, i) => {
    mapa.push("-map", `0:${a.index}`);
    flujos.push(`a:${i},agroup:aud,language:${idiomaDe(a) || "und"},name:a${i}${i === 0 ? ",default:yes" : ""}`);
  });
  return [
    ...mapa,
    ...argsVideo,
    "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000",
    "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
    "-hls_flags", "independent_segments", "-hls_segment_type", "mpegts",
    "-master_pl_name", "master.m3u8",
    // Rutas relativas con «/», con ffmpeg trabajando DESDE la carpeta de salida.
    "-hls_segment_filename", "%v/s%05d.ts",
    "-var_stream_map", flujos.join(" "),
    "%v/index.m3u8",
  ];
}

/**
 * ffmpeg llama a los audios «audio_1»…; el selector del reproductor enseña
 * NAME, así que se pone el de verdad. Se busca por su URI (a0/, a1/…).
 */
export function maestraConNombres(texto, analisis) {
  let salida = texto;
  analisis.audios.forEach((a, i) => {
    const nombre = nombreDePista(a, `Audio ${i + 1}`).replace(/"/g, "'");
    salida = salida.replace(new RegExp(`NAME="[^"]*"(?=[^\\r\\n]*URI="a${i}/)`), `NAME="${nombre}"`);
  });
  return salida;
}

/**
 * Los subtítulos de DENTRO del archivo que se quedan: por idioma (un MKV
 * puede traer 40), solo los de texto.
 */
export function subtitulosInternos(analisis, idiomas = ["spa", "eng"]) {
  const todos = idiomas.includes("todos");
  const quiero = new Set(idiomas.map(normalizarIdioma));
  const elegidos = [];
  let imagenes = 0;
  for (const s of analisis.subtitulos) {
    const idioma = idiomaDe(s);
    if (!todos && !quiero.has(normalizarIdioma(idioma))) continue;
    if (!DE_TEXTO.has(s.codec_name)) {
      imagenes++;
      continue;
    }
    let etiqueta = nombreDePista(s, "Subtítulos");
    if (s.disposition?.forced === 1 && !/forz|forced/i.test(etiqueta)) etiqueta += " (forzados)";
    elegidos.push({ index: s.index, idioma: normalizarIdioma(idioma) || "und", srclang: idiomaCorto(idioma), etiqueta });
  }
  return { elegidos, imagenes };
}

/** ¿Es UTF-8 válido? Un .srt descargado suele venir en Windows-1252. */
export function esUtf8(buffer) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}
