import "server-only";

import type { ServidorStream } from "@/lib/resolvers/types";

/**
 * ¿Este servidor tiene de verdad el título?
 *
 * Durante mucho tiempo la respuesta en este proyecto fue «no se puede saber»,
 * y para casi todo sigue siendo cierta: el iframe es de otro dominio, así que
 * no se ve si el vídeo arrancó, ni si el reproductor dio error, ni si su
 * puerta antirrobot está dando vueltas en un marco nieto.
 *
 * Pero hay **una** pregunta que sí se puede hacer, y es justamente la que más
 * molestaba: «¿tienes este título?». Medido con curl contra catorce ids
 * reales:
 *
 * | Proveedor  | No lo tiene            | Sí lo tiene   | ¿Sirve? |
 * |------------|------------------------|---------------|---------|
 * | vimeus     | **404** `Not Found`    | 200, 6,7 KB   | **sí**  |
 * | vidlink    | **500**                | 200, 82 KB    | **sí**  |
 * | videasy    | 200, 17.490 B          | 200, 17.472 B | no      |
 * | vidsrc     | 200, 71.978 B          | 200, 71.972 B | no      |
 * | multiembed | 403 de Cloudflare      | —             | no      |
 *
 * Y no es teórico: `tmdb=1274639` es una película real que Vimeus devuelve
 * como 404 y Vidlink como 200. Ese es exactamente el caso que se veía como
 * «sale Not Found y hay que cambiar de servidor a mano».
 *
 * Los otros tres se dan por disponibles siempre. **Nunca se esconde un
 * servidor por una suposición**: solo por un estado HTTP que ya se comprobó
 * que significa lo que parece.
 */

/** Cuánto se espera a un proveedor antes de darlo por bueno y seguir. */
const ESPERA_MS = 2_500;

/** Cuánto vale una respuesta antes de volver a preguntar. */
const VIGENCIA_MS = 60 * 60 * 1000;

/** Tope de entradas recordadas, para que la memoria no crezca sin fin. */
const MAX_ENTRADAS = 2_000;

const memoria = new Map<string, { tiene: boolean; caduca: number }>();

/**
 * Filtra los servidores que han dicho que no tienen el título.
 *
 * **A prueba de fallos abierta.** Si la petición falla, tarda más de la cuenta
 * o la bloquean por venir de una IP de centro de datos, el servidor **se
 * conserva**. Un proveedor de menos por un error de red sería peor que el
 * problema que esto arregla: quien está delante vería una lista más corta sin
 * saber por qué, y sin forma de recuperar el que falta.
 */
export async function servidoresConElTitulo(
  candidatos: ServidorStream[],
): Promise<ServidorStream[]> {
  const veredictos = await Promise.all(
    candidatos.map(async (servidor) => {
      if (!servidor.compruebaPorEstado) return true;
      return tieneElTitulo(servidor.id, servidor.url);
    }),
  );
  return candidatos.filter((_, i) => veredictos[i]);
}

async function tieneElTitulo(id: string, url: string): Promise<boolean> {
  const clave = `${id}|${url}`;
  const ahora = Date.now();

  const guardado = memoria.get(clave);
  if (guardado && guardado.caduca > ahora) return guardado.tiene;

  let tiene = true;
  try {
    // `GET` y no `HEAD`: varios de estos servidores responden 405 o 200 a un
    // HEAD sin llegar a resolver el título, así que el estado no diría nada.
    const respuesta = await fetch(url, {
      signal: AbortSignal.timeout(ESPERA_MS),
      cache: "no-store",
      redirect: "follow",
    });
    // 404 y 500 son los dos que se comprobaron. Cualquier otro estado —incluido
    // un 403 de Cloudflare, que habla de nosotros y no del título— se deja
    // pasar.
    if (respuesta.status === 404 || respuesta.status === 500) tiene = false;
    // El cuerpo no se lee: solo interesa el estado, y descargarlo sería tirar
    // ancho de banda del servidor en cada ficha que alguien abra.
    await respuesta.body?.cancel();
  } catch {
    // Tiempo agotado, DNS caído, bloqueo por IP: no es una respuesta sobre el
    // título, así que no se descarta nada.
    tiene = true;
  }

  if (memoria.size >= MAX_ENTRADAS) memoria.clear();
  memoria.set(clave, { tiene, caduca: ahora + VIGENCIA_MS });
  return tiene;
}

/** Solo para las pruebas: olvida lo aprendido. */
export function olvidarDisponibilidad(): void {
  memoria.clear();
}
