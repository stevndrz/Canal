/**
 * El estado del PC que sube las películas, visto desde cualquier aparato.
 *
 * Lo escribe el sincronizador en `peliculas/estado.json` del bucket
 * (`scripts/peliculas/sincronizar/lib/estado-publico.mjs`) y aquí solo se lee
 * y se pone en palabras: «Convirtiendo Buddy · 62 %», «Sincronizado hace
 * 5 min · 7,2 de 10 GB». Así se sabe sin ir al PC si la película ya casi está.
 *
 * Viene de fuera de la app, como el catálogo: lo que no tenga la forma
 * esperada se descarta entero.
 */

export interface EstadoPc {
  /** Cuándo escribió el PC por última vez (ms). */
  actualizado: number;
  /** Lo escribió «Sincronizar sola» (cada 10 min) y no alguien a mano. */
  automatica: boolean;
  haciendo: { fase: "convertir" | "subir"; titulo: string; porcentaje: number | null } | null;
  /** Bytes usados en la nube y su tope, si se saben. */
  usado: number | null;
  limite: number | null;
  /** Cosas que esperan una decisión en el PC (la automática nunca borra). */
  pendientes: number;
  fallo: boolean;
}

export function rutaEstadoPc(base: string): string {
  return `${base}/peliculas/estado.json`;
}

const positivo = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

export function leerEstadoPc(crudo: unknown): EstadoPc | null {
  if (!crudo || typeof crudo !== "object") return null;
  const e = crudo as Record<string, unknown>;
  const actualizado = typeof e.actualizado === "string" ? Date.parse(e.actualizado) : NaN;
  if (!Number.isFinite(actualizado)) return null;

  let haciendo: EstadoPc["haciendo"] = null;
  if (e.haciendo && typeof e.haciendo === "object") {
    const h = e.haciendo as Record<string, unknown>;
    const titulo = typeof h.titulo === "string" ? h.titulo.trim().slice(0, 120) : "";
    if ((h.fase === "convertir" || h.fase === "subir") && titulo) {
      const p = positivo(h.porcentaje);
      haciendo = { fase: h.fase, titulo, porcentaje: p === null ? null : Math.min(100, Math.floor(p)) };
    }
  }
  return {
    actualizado,
    automatica: e.automatica === true,
    haciendo,
    usado: positivo(e.usado),
    limite: positivo(e.limite) || null,
    pendientes: Math.floor(positivo(e.pendientes) ?? 0),
    fallo: e.fallo === true,
  };
}

/** «ahora mismo», «hace 5 min», «hace 3 h», «hace 2 días». */
export function hace(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

/** 7730941133 → «7,2»; sin decimal cuando es redondo («10»). */
function gigas(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  const texto = gb >= 100 ? String(Math.round(gb)) : gb.toFixed(1);
  return texto.replace(/\.0$/, "").replace(".", ",");
}

/**
 * Mientras trabaja, el PC escribe al menos una vez por minuto. Si lleva más
 * que esto callado a media película, es que se apagó o se cortó: decir
 * «Convirtiendo · 62 %» sería enseñar un dato muerto como si estuviera vivo.
 */
export const CALLADO_MS = 5 * 60_000;

export interface FrasePc {
  texto: string;
  /** `activo`: está trabajando ahora. `aviso`: algo espera al dueño. */
  tono: "activo" | "normal" | "aviso";
}

const FASE = { convertir: "Convirtiendo", subir: "Subiendo" } as const;
const FASE_CORTADA = { convertir: "convirtiendo", subir: "subiendo" } as const;

export function fraseDelPc(estado: EstadoPc | null, ahora: number): FrasePc | null {
  if (!estado) return null;
  const edad = ahora - estado.actualizado;
  const { haciendo } = estado;

  if (haciendo) {
    const cuanto = haciendo.porcentaje === null ? "" : ` · ${haciendo.porcentaje} %`;
    if (edad < CALLADO_MS) return { texto: `${FASE[haciendo.fase]} «${haciendo.titulo}»${cuanto}`, tono: "activo" };
    return {
      texto: `El PC se quedó ${FASE_CORTADA[haciendo.fase]} «${haciendo.titulo}»${cuanto} ${hace(edad)}. Seguirá al encenderlo.`,
      tono: "aviso",
    };
  }

  const partes = [estado.fallo ? `La última sincronización falló (${hace(edad)})` : `Sincronizado ${hace(edad)}`];
  if (estado.usado !== null && estado.limite) partes.push(`${gigas(estado.usado)} de ${gigas(estado.limite)} GB`);
  if (estado.pendientes > 0) partes.push(estado.pendientes === 1 ? "1 cosa por decidir en el PC" : `${estado.pendientes} cosas por decidir en el PC`);
  return { texto: partes.join(" · "), tono: estado.fallo || estado.pendientes > 0 ? "aviso" : "normal" };
}
