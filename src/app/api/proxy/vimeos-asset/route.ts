import { NextResponse, type NextRequest } from "next/server";
import { publicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIMEOS_BASE = "https://vimeos.net";
const VIMEUS_REFERER = "https://vimeus.com/";
const UA_NAVEGADOR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const DOMINIOS_PERMITIDOS = ["vimeos.net", "vimeus.com", "lamovie.link"];

/**
 * Proxy de assets de vimeos.net con el `Referer` correcto.
 *
 * Cloudflare valida el origen: si un iframe con origen `tudominio.com`
 * incrusta HTML servido por nosotros y JWPlayer pide sus assets a
 * `vimeos.net`, las requests salen con `Referer: https://tudominio.com` y
 * caen en 403. Pasamos por acá para inyectar el header y devolver el
 * contenido con `Access-Control-Allow-Origin: *` para que JWPlayer pueda
 * leerlo sin problemas de CORS.
 *
 * Caso especial: si el destino es un `.m3u8`, las URLs internas son
 * relativas a `vimeos.net` (la URL del manifest original). Las reescribimos
 * a absolutas contra `vimeos.net` para que JWPlayer las pida con el
 * `Referer` correcto, sin tener que volver a pasar por nosotros en cada
 * segmento. Si lo hiciéramos, cada `.ts` pagaría un round-trip y la cuota
 * de la función serverless se acabaría en una sola sesión.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const destino = request.nextUrl.searchParams.get("u");
  if (!destino) {
    return NextResponse.json({ error: "falta u" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(destino);
  } catch {
    return NextResponse.json({ error: "url inválida" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "esquema no permitido" }, { status: 400 });
  }

  const host = parsed.hostname.toLowerCase();
  if (!DOMINIOS_PERMITIDOS.some((permitido) => host === permitido || host.endsWith(`.${permitido}`))) {
    return NextResponse.json({ error: "dominio no permitido" }, { status: 400 });
  }

  const referer = parsed.hostname.endsWith("vimeus.com") || parsed.hostname.endsWith("lamovie.link")
    ? VIMEUS_REFERER
    : `${VIMEOS_BASE}/`;

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": UA_NAVEGADOR,
        Referer: referer,
        Accept: "*/*",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream no responde", detalle: String(error) },
      { status: 502 }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const cacheControl = upstream.headers.get("cache-control") ?? "public, max-age=3600";

  if (upstream.ok && /\.m3u8($|\?)/i.test(parsed.pathname)) {
    const texto = await upstream.text();
    const origenPropio = publicConfig.sitioUrl || request.nextUrl.origin;
    const reescrito = reescribirM3u8(texto, parsed, origenPropio);
    return new NextResponse(reescrito, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": cacheControl,
        "Access-Control-Allow-Origin": "*",
        "X-Proxy-Vimeos": "m3u8",
      },
    });
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "Access-Control-Allow-Origin": "*",
    "X-Proxy-Vimeos": "1",
  });

  return new Response(upstream.body, { status: upstream.status, headers });
}

/**
 * Reescribe las URLs internas de un `.m3u8` para que cada segmento pase por
 * este mismo proxy. Es la única forma de garantizar el `Referer` correcto
 * hacia `vimeos.net` desde dentro del iframe (los iframes no pueden cambiar
 * el `Referer` por sí mismos).
 *
 * El costo es un round-trip por segmento a una función serverless. En Vercel
 * con Edge Functions va sobrado para una película (≈ 200 segmentos × 10 ms).
 *
 * Las URLs relativas se resuelven contra el manifest original (no contra
 * este proxy), porque ese es el origen real del archivo.
 */
function reescribirM3u8(texto: string, destinoOriginal: URL, origenPropio: string): string {
  const baseProxy = `${origenPropio}/api/proxy/vimeos-asset?u=`;
  return texto
    .split("\n")
    .map((linea) => {
      const trimmed = linea.trim();
      if (!trimmed || trimmed.startsWith("#")) return linea;
      let absoluta: string;
      try {
        absoluta = new URL(trimmed, destinoOriginal).toString();
      } catch {
        return linea;
      }
      const reescrita = `${baseProxy}${encodeURIComponent(absoluta)}`;
      return linea.replace(trimmed, reescrita);
    })
    .join("\n");
}