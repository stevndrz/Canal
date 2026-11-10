import { leerSubtitulos } from "./catalogo";
import { apuntar, leerHistorial, type VistaJuntos } from "./historial";
import { ID_APARATO, limpiarNombre, normalizarCodigo, type PeliculaDeSala } from "./sala";

/**
 * Lo que cada aparato recuerda de «Ver juntos».
 *
 * - **Su perfil** (`localStorage`): el alias que eligió la persona y un id al
 *   azar para la presencia. Se elige una vez; se puede cambiar.
 * - **La sala en la que está** (`sessionStorage`): el código y su película.
 *   Salir de Mi enlace —Atrás en el mando— no saca de la sala; al volver se
 *   entra sola. Dura lo que la pestaña.
 * - **La última sala** (`localStorage`): solo su código, para ofrecer «Volver
 *   a la sala 4821» otro día. Si los dos aparatos vuelven a la misma, es como
 *   tener una sala fija de la casa sin tener que dictarse el código cada vez.
 * - **Lo visto juntos** (`localStorage`): ver `historial.ts`.
 */

const CLAVE_PERFIL = "canalcasa:juntos-perfil";
const CLAVE_SALA = "canalcasa:ver-juntos";
const CLAVE_ULTIMA = "canalcasa:juntos-ultima-sala";
const CLAVE_HISTORIAL = "canalcasa:juntos-historial";

export interface Perfil {
  id: string;
  nombre: string;
}

export interface SalaRecordada {
  codigo: string;
  pelicula: PeliculaDeSala | null;
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
    // Es una comodidad: sin ella se vuelve a escribir el alias o el código.
  }
}

export function crearIdAparato(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

export function leerPerfil(): Perfil | null {
  const p = leer("local", CLAVE_PERFIL) as Record<string, unknown> | null;
  if (!p || typeof p !== "object" || typeof p.id !== "string" || !ID_APARATO.test(p.id)) return null;
  const nombre = limpiarNombre(p.nombre);
  return nombre ? { id: p.id, nombre } : null;
}

export function guardarPerfil(perfil: Perfil): void {
  escribir("local", CLAVE_PERFIL, perfil);
}

function leerPelicula(p: unknown): PeliculaDeSala | null {
  if (!p || typeof p !== "object") return null;
  const r = p as Record<string, unknown>;
  const v = r.video as Record<string, unknown> | null;
  if (!v || typeof v.url !== "string" || !/^https?:\/\//i.test(v.url)) return null;
  if (typeof r.version !== "number" || typeof r.por !== "string") return null;
  const subtitulos = leerSubtitulos(v.subtitulos);
  return {
    video: { url: v.url, titulo: typeof v.titulo === "string" ? v.titulo : "", ...(subtitulos.length ? { subtitulos } : {}) },
    version: r.version,
    por: r.por,
  };
}

export function leerSalaRecordada(): SalaRecordada | null {
  const s = leer("session", CLAVE_SALA) as Record<string, unknown> | null;
  if (!s || typeof s !== "object") return null;
  const codigo = normalizarCodigo(String(s.codigo ?? ""));
  return codigo ? { codigo, pelicula: leerPelicula(s.pelicula) } : null;
}

export function recordarSala(sala: SalaRecordada | null): void {
  escribir("session", CLAVE_SALA, sala);
}

export function leerUltimaSala(): string {
  return normalizarCodigo(String(leer("local", CLAVE_ULTIMA) ?? ""));
}

export function recordarUltimaSala(codigo: string): void {
  if (normalizarCodigo(codigo)) escribir("local", CLAVE_ULTIMA, codigo);
}

export function leerVistasJuntos(): VistaJuntos[] {
  return leerHistorial(leer("local", CLAVE_HISTORIAL));
}

/** Apunta por dónde va la película de la sala y devuelve el historial nuevo. */
export function apuntarVistaJuntos(vista: VistaJuntos): VistaJuntos[] {
  const nuevo = apuntar(leerVistasJuntos(), vista);
  escribir("local", CLAVE_HISTORIAL, nuevo);
  return nuevo;
}
