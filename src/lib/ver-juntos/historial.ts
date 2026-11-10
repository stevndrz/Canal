/**
 * «Seguir viendo juntos»: por dónde iba cada película que se vio en una sala.
 *
 * Lo guarda **cada aparato** de la sala mientras se ve (`localStorage`): no
 * hay servidor ni base de datos. Como todos van sincronizados, todos apuntan
 * lo mismo, y al día siguiente cualquiera de ellos puede ofrecer «Retomar en
 * 47:10», dirija quien dirija. Un aparato que no estuvo aquel día no lo sabe:
 * se entera cuando el otro pulsa «Retomar», que mueve a toda la sala.
 *
 * Sin React ni `localStorage` aquí dentro, para poder probarlo.
 */

export interface VistaJuntos {
  url: string;
  titulo: string;
  /** Segundo por el que iban. */
  posicion: number;
  /** Duración total, o 0 si no se sabía. */
  duracion: number;
  /** Cuándo fue (ms). Ordena el historial. */
  visto: number;
  /** Con quién: los alias de los otros aparatos de la sala. */
  con: string[];
}

export const MAX_HISTORIAL = 30;
/** Menos de esto es no haber empezado: ofrecer «Retomar en 0:20» es ruido. */
export const MINIMO_RETOMAR_S = 60;
/** A partir de aquí se da por vista (los créditos): no se ofrece retomar. */
export const TERMINADA = 0.94;

const esHttp = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//i.test(v);
const numero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/** Lo guardado, leído con desconfianza: lo que no tenga forma se descarta. */
export function leerHistorial(crudo: unknown): VistaJuntos[] {
  if (!Array.isArray(crudo)) return [];
  const vistas: VistaJuntos[] = [];
  const urls = new Set<string>();
  for (const e of crudo) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    if (!esHttp(r.url) || urls.has(r.url)) continue;
    urls.add(r.url);
    vistas.push({
      url: r.url,
      titulo: typeof r.titulo === "string" ? r.titulo.slice(0, 200) : "",
      posicion: numero(r.posicion),
      duracion: numero(r.duracion),
      visto: numero(r.visto),
      con: Array.isArray(r.con) ? r.con.filter((c): c is string => typeof c === "string").slice(0, 8) : [],
    });
  }
  return vistas.sort((a, b) => b.visto - a.visto).slice(0, MAX_HISTORIAL);
}

/** Apunta (o actualiza) una película; la más reciente, primero. */
export function apuntar(historial: readonly VistaJuntos[], vista: VistaJuntos): VistaJuntos[] {
  const anterior = historial.find((v) => v.url === vista.url);
  // Si ahora se ve a solas un rato, no se pierde con quién se vio.
  const con = vista.con.length > 0 ? vista.con : (anterior?.con ?? []);
  return [{ ...vista, con }, ...historial.filter((v) => v.url !== vista.url)].slice(0, MAX_HISTORIAL);
}

/** El segundo desde el que ofrecer «Retomar», o `null` si no tiene sentido. */
export function dondeRetomar(vista: VistaJuntos | undefined): number | null {
  if (!vista || vista.posicion < MINIMO_RETOMAR_S) return null;
  if (vista.duracion > 0 && vista.posicion >= vista.duracion * TERMINADA) return null;
  return Math.floor(vista.posicion);
}

/** 70 → «1:10»; 3723 → «1:02:03». */
export function reloj(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** «Iban por 47:10 de 1:45:00 · con Tele sala · ayer». */
export function resumen(vista: VistaJuntos, ahora: number): string {
  const partes: string[] = [];
  const retomar = dondeRetomar(vista);
  if (retomar !== null) partes.push(`Iban por ${reloj(retomar)}${vista.duracion > 0 ? ` de ${reloj(vista.duracion)}` : ""}`);
  else if (vista.duracion > 0 && vista.posicion >= vista.duracion * TERMINADA) partes.push("Terminada");
  if (vista.con.length > 0) partes.push(`con ${vista.con.join(" y ")}`);
  const dias = Math.floor((ahora - vista.visto) / 86_400_000);
  partes.push(dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`);
  return partes.join(" · ");
}
