import { leerSubtitulos } from "./catalogo";
import { CANAL_SALA, type PeliculaDeSala } from "./sala";

/**
 * Lo que cada aparato recuerda de la sala.
 *
 * - **El vínculo** (`localStorage`): la llave de `/api/sala/vincular`, el
 *   canal y el nombre. Se guarda una vez y dura hasta que se cambie el PIN o
 *   el secreto en Vercel, o se desvincule a mano.
 * - **La película de la sala** (`localStorage`): la última elegida que este
 *   aparato conoce. Al encontrarse con otro, gana la más nueva (`masNueva`).
 * - **Los conocidos** (`localStorage`): nombres de los aparatos que se han
 *   visto en la sala, para que el círculo de «esperando» diga quién falta.
 * - **Si estaba dentro** (`sessionStorage`): salir de Mi enlace —Atrás en el
 *   mando— no saca de la sala; al volver se entra sola. Dura lo que la
 *   pestaña: mañana se vuelve a pulsar «Entrar».
 */

const CLAVE_APARATO = "canalcasa:sala-aparato";
const CLAVE_PELICULA = "canalcasa:sala-pelicula";
const CLAVE_CONOCIDOS = "canalcasa:sala-conocidos";
const CLAVE_DENTRO = "canalcasa:ver-juntos";

export interface Aparato {
  llave: string;
  canal: string;
  id: string;
  nombre: string;
}

function leer(almacen: "local" | "session", clave: string): unknown {
  try {
    const a = almacen === "local" ? window.localStorage : window.sessionStorage;
    return JSON.parse(a.getItem(clave) ?? "null");
  } catch {
    // Sin almacenamiento (modo privado, tele que no lo da): no se recuerda.
    return null;
  }
}

function escribir(almacen: "local" | "session", clave: string, valor: unknown): void {
  try {
    const a = almacen === "local" ? window.localStorage : window.sessionStorage;
    if (valor === null) a.removeItem(clave);
    else a.setItem(clave, JSON.stringify(valor));
  } catch {
    // Es una comodidad: sin ella se vuelve a vincular o a elegir.
  }
}

export function leerAparato(): Aparato | null {
  const a = leer("local", CLAVE_APARATO) as Record<string, unknown> | null;
  if (!a || typeof a !== "object") return null;
  const { llave, canal, id, nombre } = a;
  if (typeof llave !== "string" || typeof id !== "string" || typeof nombre !== "string") return null;
  if (typeof canal !== "string" || !CANAL_SALA.test(canal)) return null;
  return { llave, canal, id, nombre };
}

export function guardarAparato(aparato: Aparato | null): void {
  escribir("local", CLAVE_APARATO, aparato);
}

export function leerPeliculaRecordada(): PeliculaDeSala | null {
  const p = leer("local", CLAVE_PELICULA) as Record<string, unknown> | null;
  if (!p || typeof p !== "object") return null;
  const v = p.video as Record<string, unknown> | null;
  if (!v || typeof v.url !== "string" || !/^https?:\/\//i.test(v.url)) return null;
  if (typeof p.version !== "number" || typeof p.por !== "string") return null;
  const subtitulos = leerSubtitulos(v.subtitulos);
  return {
    video: { url: v.url, titulo: typeof v.titulo === "string" ? v.titulo : "", ...(subtitulos.length ? { subtitulos } : {}) },
    version: p.version,
    por: p.por,
  };
}

export function recordarPelicula(pelicula: PeliculaDeSala | null): void {
  escribir("local", CLAVE_PELICULA, pelicula);
}

export function leerConocidos(): Record<string, string> {
  const c = leer("local", CLAVE_CONOCIDOS);
  if (!c || typeof c !== "object") return {};
  return Object.fromEntries(
    Object.entries(c as Record<string, unknown>).filter((par): par is [string, string] => typeof par[1] === "string"),
  );
}

export function recordarConocidos(conocidos: Record<string, string>): void {
  escribir("local", CLAVE_CONOCIDOS, conocidos);
}

export function estabaDentro(): boolean {
  return leer("session", CLAVE_DENTRO) === true;
}

export function recordarDentro(dentro: boolean): void {
  escribir("session", CLAVE_DENTRO, dentro ? true : null);
}
