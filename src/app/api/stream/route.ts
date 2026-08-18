export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new Response("URL requerida", { status: 400 });
  }

  try {
    // Hacemos la petición al stream original simulando ser un reproductor de escritorio/VLC
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "VLC/3.0.18",
        "Accept": "*/*",
      },
      // Esto permite seguir redirecciones si el stream cambia de servidor en vivo
      redirect: "follow",
    });

    // Copiamos los headers originales y les inyectamos las reglas para anular CORS
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "*");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return new Response("Error al retransmitir el stream", { status: 500 });
  }
}