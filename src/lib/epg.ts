import { gunzipSync } from "node:zlib";
import { channelNameVariants, normalizeChannelName } from "./text";
import { paraRegistro } from "./url-segura";
import { paisDeCanal } from "./origenes";

export interface EpgProgramme {
  title: string;
  start: number;
  stop: number;
}

export type EpgByChannel = Map<string, EpgProgramme[]>;

export interface EpgEntry {
  current: EpgProgramme | null;
  next: EpgProgramme | null;
}

export interface EpgGuide {
  programmesByChannel: EpgByChannel;
  // Normaliza nombre de canal -> id XMLTV. Sirve de respaldo cuando la
  // lista M3U no trae tvg-id (caso común en listas públicas grandes).
  idByName: Map<string, string>;
  /**
   * `pais|nombre` → id XMLTV, con el nombre ya limpio de lo que las guías le
   * cuelgan: «Canal 7 - Televisiete.gt» se guarda como `gt|canal7`. Va aparte
   * y con el país delante porque, limpio, «Canal 7» hay en cinco países: solo
   * se usa cuando el canal de la lista es de ese mismo país. Varios ids por
   * clave: al juntar guías, dos pueden limpiar al mismo nombre.
   */
  idPorPais: Map<string, string[]>;
}

// Las guías compartidas cubren cientos de canales de varios países: sin tope,
// una función sin servidor se ahoga interpretándolas.
const MAX_EPG_BYTES = 15 * 1024 * 1024;
/** Tope tras descomprimir: un .gz pequeño puede expandirse a cientos de MB. */
const MAX_EPG_TEXT_BYTES = 150 * 1024 * 1024;
const MAX_PROGRAMMES = 200_000;
const MAX_CHANNELS = 50_000;

/** Cuánto se reutiliza la guía ya interpretada antes de volver a descargarla. */
const EPG_CACHE_MS = 10 * 60 * 1000;

/**
 * Corto a propósito: los horarios son un adorno y la lista tiene que salir
 * aunque el EPG no conteste. Muchas listas apuntan a servicios gratuitos que se
 * duermen medio minuto. Un fallo se cachea igual que un acierto.
 */
const EPG_TIMEOUT_MS = 5000;

/** Interpretar un XMLTV de miles de canales cuesta, y cambia cada pocos minutos. */
const cachedEpg = new Map<string, { guide: EpgGuide | null; expiresAt: number }>();

/**
 * `deLaLista` es una diferencia de confianza, no de forma: `false` la puso
 * quien despliega en `EPG_URL` y puede apuntar donde quiera, incluida la red
 * local; `true` venía dentro del M3U y **la eligió quien controla esa lista**,
 * que con una lista pública no es quien despliega. Solo esa se comprueba.
 */
export async function fetchEpg(url: string, deLaLista = false): Promise<EpgGuide | null> {
  const guardada = cachedEpg.get(url);
  if (guardada && guardada.expiresAt > Date.now()) return guardada.guide;

  const guide = await downloadAndParseEpg(url, deLaLista);
  cachedEpg.set(url, { guide, expiresAt: Date.now() + EPG_CACHE_MS });
  return guide;
}

/** Una guía a descargar y cuánto fiarse de quien la eligió (ver `fetchEpg`). */
export interface FuenteDeGuia {
  url: string;
  deLaLista: boolean;
}

/**
 * Descarga varias guías a la vez y las junta en una. Ninguna puede tumbar a
 * las demás: la que falle o no conteste a tiempo simplemente no aporta.
 */
export async function fetchGuias(fuentes: readonly FuenteDeGuia[]): Promise<EpgGuide | null> {
  const guias = await Promise.all(fuentes.map((f) => fetchEpg(f.url, f.deLaLista)));
  return combinarGuias(guias.filter((g): g is EpgGuide => g !== null));
}

/**
 * Junta guías **sin mezclar canales**: si dos traen el mismo id, manda la
 * primera entera. Mezclar los programas de dos fuentes del mismo canal daría
 * solapes (cada una corta los programas a su manera).
 */
export function combinarGuias(guias: readonly EpgGuide[]): EpgGuide | null {
  if (guias.length === 0) return null;
  if (guias.length === 1) return guias[0];
  const juntas: EpgGuide = { programmesByChannel: new Map(), idByName: new Map(), idPorPais: new Map() };
  for (const guia of guias) {
    for (const [id, programas] of guia.programmesByChannel) {
      if (!juntas.programmesByChannel.has(id)) juntas.programmesByChannel.set(id, programas);
    }
    for (const [clave, id] of guia.idByName) if (!juntas.idByName.has(clave)) juntas.idByName.set(clave, id);
    for (const [clave, ids] of guia.idPorPais) juntas.idPorPais.set(clave, [...(juntas.idPorPais.get(clave) ?? []), ...ids]);
  }
  return juntas;
}

/**
 * Solo mira el texto. **No resuelve DNS**, así que un nombre público cuyo
 * registro A apunte a `10.0.0.5` pasa, y el reenlace de DNS también; cerrarlo
 * de verdad exige fijar la IP resuelta en la conexión, y `fetch` no deja
 * hacerlo sin un agente propio. Lo que zanja el asunto es poner `EPG_URL`, y
 * entonces el `url-tvg` de la lista no se usa.
 */
function hostInterno(hostname: string): boolean {
  // IPv6 llega entre corchetes en `hostname`; se quitan para poder mirarlo.
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (host === "localhost" || /\.(localhost|local|internal|home\.arpa)$/.test(host)) return true;

  // IPv6: bucle local (::1), únicas locales (fc00::/7) y de enlace (fe80::/10).
  if (host === "::1" || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) {
    return true;
  }

  // IPv4, también en su forma mapeada a IPv6 (`::ffff:10.0.0.1`).
  const ipv4 = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // privada
    a === 127 || // bucle local
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // enlace local: metadatos de la nube
    (a === 172 && b >= 16 && b <= 31) || // privada
    (a === 192 && b === 168) // privada
  );
}

async function downloadAndParseEpg(url: string, deLaLista: boolean): Promise<EpgGuide | null> {
  /**
   * Solo `https:`. Es el ÚNICO punto donde contenido remoto —el `url-tvg` de
   * dentro del M3U— decide a dónde sale una petición del servidor: quien
   * controle esa lista tendría si no un primitivo de petición saliente, y los
   * títulos que devuelva se pintan en la guía. El riesgo aparece al apuntar
   * `M3U_URL` a una lista pública, que es lo que invita a hacer el README.
   */
  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    console.error(`❌ La URL de la guía EPG no es válida — ${paraRegistro(url)}`);
    return null;
  }
  if (destino.protocol !== "https:") {
    console.error(`❌ Guía EPG rechazada: solo se aceptan URLs https — ${paraRegistro(url)}`);
    return null;
  }

  /**
   * `https:` sola no basta: dentro de https queda toda la red interna. Y no es
   * ciego del todo — lo que responda se interpreta como XMLTV y **sus títulos
   * se pintan en la guía**, así que parte del contenido vuelve a verse.
   */
  if (deLaLista && hostInterno(destino.hostname)) {
    console.error(
      `❌ Guía EPG rechazada: la lista M3U apunta a una dirección interna — ${paraRegistro(url)}. ` +
        "Configura EPG_URL si esa guía es tuya.",
    );
    return null;
  }

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(EPG_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`❌ La guía EPG respondió HTTP ${res.status} — ${paraRegistro(url)}`);
      return null;
    }

    const tooLarge = (bytes: number) => {
      console.error(
        `❌ Guía EPG descartada por tamaño (${Math.round(bytes / 1024 / 1024)} MB). ` +
          "Configura EPG_URL con una guía más pequeña si quieres horarios."
      );
      return null;
    };

    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_EPG_BYTES) return tooLarge(contentLength);

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_EPG_BYTES) return tooLarge(buffer.byteLength);

    const isGzip = buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
    const xml = isGzip
      ? gunzipSync(buffer, { maxOutputLength: MAX_EPG_TEXT_BYTES }).toString("utf-8")
      : buffer.toString("utf-8");

    return parseXmltv(xml);
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? `no respondió en ${EPG_TIMEOUT_MS / 1000}s (¿servidor dormido?)`
        : String(error);
    console.error(`❌ Guía EPG descartada: ${reason} — ${paraRegistro(url)}`);
    return null;
  }
}

function getAttr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .trim();
}

function extractTitle(inner: string): string {
  const match = inner.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  return match ? decodeXmlEntities(match[1]) : "";
}

// Formato XMLTV: YYYYMMDDHHmmss seguido de un offset opcional (+HHMM/-HHMM).
/**
 * Una marca de tiempo de XMLTV a milisegundos.
 *
 * El formato es `20260821183000 -0600`: catorce dígitos y, opcionalmente, un
 * desfase horario. Sin desfase se interpreta como UTC, que es lo que hacen los
 * lectores de XMLTV cuando la guía no lo dice.
 */
function parseXmltvTime(value: string): number | null {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
  if (!match) return null;

  const [, y, mo, d, h, mi, s, tz] = match;
  const enUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return enUtc - desfaseEnMs(tz);
}

/** `-0600` → -21.600.000 ms. Sin desfase, cero. */
function desfaseEnMs(tz: string | undefined): number {
  if (!tz) return 0;
  const signo = tz[0] === "-" ? -1 : 1;
  const minutos = Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5));
  return signo * minutos * 60_000;
}

/**
 * Interpreta una guía XMLTV, en dos pasadas separadas porque son dos trabajos:
 * el índice de **nombre → id** y la lista de programas por canal.
 *
 * Con expresiones regulares y no con un analizador de XML a propósito: estas
 * guías pesan decenas de megabytes y montar un DOM para sacar cuatro atributos
 * por nodo costaría más memoria de la que tiene un televisor.
 */
export function parseXmltv(xml: string): EpgGuide {
  const { idPorNombre, idPorPais } = indexarCanales(xml);
  return {
    idByName: idPorNombre,
    idPorPais,
    programmesByChannel: indexarProgramas(xml),
  };
}

/** El país al final de un id XMLTV: `Canal 3.gt`, `Canal7.gt@SD` → `gt`. */
function paisDelId(id: string): string {
  const match = id.split("@")[0].trim().match(/\.([a-z]{2})$/i);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Las formas limpias de un nombre de guía, para emparejar con el de la lista:
 * sin el país del final, sin lo que va tras « - » y sin paréntesis.
 * «Canal 7 - Televisiete.gt» → «Canal 7 - Televisiete», «Canal 7».
 */
export function nombresLimpios(nombre: string): string[] {
  const sinPais = nombre.replace(/\.[a-z]{2}$/i, "").replace(/\./g, " ").trim();
  const formas = [sinPais, sinPais.split(" - ")[0], sinPais.replace(/\s*\([^)]*\)/g, "")];
  return [...new Set(formas.map((f) => f.trim()).filter(Boolean))];
}

/**
 * Nombre normalizado → id de canal.
 *
 * Hace falta porque la mayoría de listas M3U públicas no traen `tvg-id`, así
 * que la única forma de emparejar un canal con su guía es por el nombre.
 * **Gana el primero**: una guía puede declarar varios `display-name` para el
 * mismo canal, y el primero es el principal.
 */
function indexarCanales(xml: string): { idPorNombre: Map<string, string>; idPorPais: Map<string, string[]> } {
  const idPorNombre = new Map<string, string>();
  const idPorPais = new Map<string, string[]>();
  const canalRe = /<channel([^>]*)>([\s\S]*?)<\/channel>/g;
  let canal: RegExpExecArray | null;
  let vistos = 0;

  while (vistos < MAX_CHANNELS && (canal = canalRe.exec(xml))) {
    vistos++;
    const [, atributos, interior] = canal;
    const id = getAttr(atributos, "id")?.trim();
    if (!id) continue;

    const pais = paisDelId(id);
    const nombreRe = /<display-name[^>]*>([\s\S]*?)<\/display-name>/g;
    let nombre: RegExpExecArray | null;
    const nombres = [id];
    while ((nombre = nombreRe.exec(interior))) {
      const texto = decodeXmlEntities(nombre[1]);
      nombres.push(texto);
      const clave = normalizeChannelName(texto);
      if (clave && !idPorNombre.has(clave)) idPorNombre.set(clave, id);
    }
    if (!pais) continue;
    for (const texto of nombres) {
      for (const limpio of nombresLimpios(texto)) {
        const clave = `${pais}|${normalizeChannelName(limpio)}`;
        const ids = idPorPais.get(clave);
        if (!ids) idPorPais.set(clave, [id]);
        else if (!ids.includes(id)) ids.push(id);
      }
    }
  }

  return { idPorNombre, idPorPais };
}

/** Id de canal → sus programas, descartando los que estén incompletos. */
function indexarProgramas(xml: string): EpgByChannel {
  const porCanal: EpgByChannel = new Map();
  const programaRe = /<programme([^>]*)>([\s\S]*?)<\/programme>/g;
  let programa: RegExpExecArray | null;
  let vistos = 0;

  while (vistos < MAX_PROGRAMMES && (programa = programaRe.exec(xml))) {
    vistos++;
    const entrada = leerPrograma(programa[1], programa[2]);
    if (!entrada) continue;

    const lista = porCanal.get(entrada.canalId);
    if (lista) lista.push(entrada.programa);
    else porCanal.set(entrada.canalId, [entrada.programa]);
  }

  return porCanal;
}

/**
 * Un `<programme>`, o `null` si le falta algo imprescindible.
 *
 * Sin canal, sin horas o sin título no se puede pintar nada: se descarta en
 * vez de guardar una entrada a medias que luego habría que comprobar en cada
 * sitio donde se lee.
 */
function leerPrograma(
  atributos: string,
  interior: string
): { canalId: string; programa: EpgProgramme } | null {
  const canalId = getAttr(atributos, "channel")?.trim().toLowerCase();
  const start = parseXmltvTime(getAttr(atributos, "start") ?? "");
  const stop = parseXmltvTime(getAttr(atributos, "stop") ?? "");
  const title = extractTitle(interior);

  if (!canalId || start == null || stop == null || !title) return null;
  return { canalId, programa: { title, start, stop } };
}

/**
 * Todas las listas de programas que pueden ser de este canal, de la más
 * segura a la menos: id exacto, id sin la señal, nombre, nombre limpio con
 * país. Devuelve todas y no la primera porque, con varias guías juntas, una
 * puede traer el canal con programas viejos y otra con los de hoy: quien
 * llama se queda con la primera que diga algo del momento pedido.
 */
function candidatos(guide: EpgGuide, tvgId: string, channelName: string): EpgProgramme[][] {
  const encontrados: EpgProgramme[][] = [];
  const anadir = (id: string | undefined) => {
    const lista = id ? guide.programmesByChannel.get(id.toLowerCase()) : undefined;
    if (lista && !encontrados.includes(lista)) encontrados.push(lista);
  };

  const byId = tvgId.trim().toLowerCase();
  if (byId) {
    anadir(byId);
    // Las listas estilo iptv-org marcan la señal en el id (`Canal3.gt@SD`)
    // mientras que la guía suele publicarlo sin ese sufijo.
    anadir(byId.split("@")[0]);
  }

  // Respaldo por nombre: la mayoría de listas públicas no traen tvg-id.
  for (const variant of channelNameVariants(channelName)) {
    anadir(guide.idByName.get(normalizeChannelName(variant)));
  }

  // Por nombre limpio y país: las guías por país (open-epg) ponen sus propios
  // ids, «Canal 7 - Televisiete.gt», que no se parecen al `tvg-id`.
  const pais = paisDeCanal({ nombre: channelName, tvgId });
  if (pais) {
    for (const variant of channelNameVariants(channelName)) {
      for (const id of guide.idPorPais.get(`${pais}|${normalizeChannelName(variant)}`) ?? []) anadir(id);
    }
  }

  return encontrados;
}

/**
 * Lo que consume la parrilla: `getEpgEntry` responde «ahora y después», que
 * basta para una fila, pero una rejilla necesita varias horas de golpe.
 *
 * Cuenta **todo lo que toca la franja**, no solo lo que empieza dentro: el
 * programa que arrancó a las 19:30 sigue en pantalla a las 20:00.
 */
export function programasEnFranja(
  guide: EpgGuide,
  tvgId: string,
  channelName: string,
  desde: number,
  hasta: number,
): EpgProgramme[] {
  for (const programmes of candidatos(guide, tvgId, channelName)) {
    const enFranja = programmes.filter((programme) => programme.stop > desde && programme.start < hasta);
    if (enFranja.length > 0) return enFranja.sort((a, b) => a.start - b.start);
  }
  return [];
}

export function getEpgEntry(guide: EpgGuide, tvgId: string, channelName: string, now: number): EpgEntry | null {
  for (const programmes of candidatos(guide, tvgId, channelName)) {
    let current: EpgProgramme | null = null;
    let next: EpgProgramme | null = null;
    for (const programme of programmes) {
      if (programme.start <= now && now < programme.stop) current = programme;
      if (programme.start > now && (!next || programme.start < next.start)) next = programme;
    }
    if (current || next) return { current, next };
  }
  return null;
}
