import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";
import { clasificarSonda, puntuarSonda } from "@/lib/sonda-salud";
import { paraRegistro } from "@/lib/url-segura";

/**
 * Sonda puntual de una URL de emisión.
 *
 * `GET /api/salud?url=https://…` descarga los primeros bytes con un tope de
 * tiempo y devuelve si responde, cuánto tarda y una puntuación 0–100. Es lo
 * que permite ordenar por calidad sin que nadie tenga que tropezar primero:
 * el cliente la llama en segundo plano para los candidatos al zapeo y el
 * respaldo con peor nota deja de ser la primera opción.
 *
 * Caché corta en memoria (10 min, 200 URLs): sondear es barato pero no gratis,
 * y el estado de un vivo no cambia cada segundo.
 */

const SONDA_TIMEOUT_MS = 8000;
const SONDA_CACHE_MS = 10 * 60 * 1000;
const SONDA_MAX_URLS = 200;

interface EntradaSonda {
  respuesta: {
    ok: boolean;
    ttffMs: number | null;
    esM3u8: boolean;
    puntos: number;
    estado: string;
  };
  expira: number;
}

const memoria = new Map<string, EntradaSonda>();

function leerCache(url: string): EntradaSonda["respuesta"] | null {
  const entrada = memoria.get(url);
  if (!entrada) return null;
  if (entrada.expira <= Date.now()) {
    memoria.delete(url);
    return null;
  }
  return entrada.respuesta;
}

function guardarCache(url: string, respuesta: EntradaSonda["respuesta"]): void {
  if (memoria.size >= SONDA_MAX_URLS) {
    const primera = memoria.keys().next().value;
    if (primera) memoria.delete(primera);
  }
  memoria.set(url, { respuesta, expira: Date.now() + SONDA_CACHE_MS });
}

export async function GET(request: Request) {
  if (excedeLimite(identificarCliente(request))) return respuestaLimite();

  const url = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!url || !/^https?:\/\//i.test(url)) {
    return Response.json({ error: "url-no-valida" }, { status: 400 });
  }

  const cacheada = leerCache(url);
  if (cacheada) {
    return Response.json(cacheada, { headers: { "Cache-Control": "no-store" } });
  }

  const inicio = Date.now();
  try {
    const respuesta = await fetch(url, {
      // Solo los primeros bytes: basta para saber si el origen responde y si
      // esto es una lista HLS de verdad.
      headers: { Range: "bytes=0-4095" },
      signal: AbortSignal.timeout(SONDA_TIMEOUT_MS),
    });
    const ttffMs = Date.now() - inicio;
    const texto = respuesta.ok ? await respuesta.text().catch(() => "") : "";
    const esM3u8 = texto.includes("#EXTM3U");
    // Un 206 parcial con cuerpo vale tanto como un 200: lo que importa es que
    // el origen respondió con algo legible.
    const ok = respuesta.ok && texto.length > 0;
    const puntos = puntuarSonda({ ok, ttffMs, esM3u8 });
    const cuerpo = { ok, ttffMs, esM3u8, puntos, estado: clasificarSonda(puntos) };
    guardarCache(url, cuerpo);
    return Response.json(cuerpo, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`❌ Sonda sin respuesta (${String(error)}) — ${paraRegistro(url)}`);
    const cuerpo = { ok: false, ttffMs: null, esM3u8: false, puntos: 0, estado: "mala" };
    guardarCache(url, cuerpo);
    return Response.json(cuerpo, { headers: { "Cache-Control": "no-store" } });
  }
}
