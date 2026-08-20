import { serverConfig } from "@/lib/config";

/**
 * Puente hacia el servicio extractor.
 *
 * El navegador **no** llama al extractor directamente, y no es por comodidad:
 *
 *  - El extractor vive en otra máquina y otro puerto. Llamarlo desde el
 *    navegador obliga a abrirle CORS a un origen público y a exponer su
 *    dirección a cualquiera que mire el código de la página.
 *  - Su dirección es configuración del despliegue, no algo que el cliente deba
 *    saber. Aquí se lee de `EXTRACTOR_URL`, que nunca sale al navegador.
 *  - Si no está configurado, la respuesta lo dice con palabras en vez de dar
 *    un error de red que en pantalla se lee como «no funciona».
 */
export const dynamic = "force-dynamic";

/** Tope de espera. El extractor tarda entre 10 y 30 s: 60 es holgado. */
const ESPERA_MS = 60_000;

export async function GET(request: Request) {
  const entrada = new URL(request.url).searchParams;
  const titulo = entrada.get("titulo")?.trim() ?? "";
  const anio = entrada.get("anio")?.trim() ?? "";
  const extractor = serverConfig().extractorUrl;

  if (!extractor) {
    return Response.json({
      estado: "sin_configurar",
      motivo:
        "Este servidor necesita el servicio extractor. Configura EXTRACTOR_URL; las instrucciones están en servicios/extractor/README.md.",
    });
  }

  if (!titulo) {
    return Response.json({ estado: "rechazado", motivo: "Falta el título." });
  }

  try {
    const consulta = new URLSearchParams({ titulo });
    if (anio) consulta.set("anio", anio);
    const respuesta = await fetch(`${extractor}/extraer?${consulta}`, {
      signal: AbortSignal.timeout(ESPERA_MS),
      cache: "no-store",
    });
    if (!respuesta.ok) {
      return Response.json({ estado: "error", motivo: "El extractor respondió con un error." });
    }
    return Response.json(await respuesta.json());
  } catch {
    // Se distingue «no llegué» de «llegué y falló»: el primero casi siempre es
    // que el servicio no está encendido, y decirlo ahorra buscar en el sitio
    // equivocado.
    return Response.json({
      estado: "sin_respuesta",
      motivo: "No se pudo contactar con el extractor. ¿Está encendido?",
    });
  }
}
