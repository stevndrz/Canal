/**
 * Salas de «Ver juntos»: cómo se llaman y qué viaja por ellas.
 *
 * Sin `node:crypto` ni nada de servidor: esto lo importan los componentes. La
 * firma vive aparte, en `firma.ts`. En la versión anterior estaban juntas y el
 * cliente importaba el módulo que traía `createHmac`.
 */

/**
 * Sin letras que se confundan al dictarlas o al leerlas en una tele lejos del
 * sofá: ni `0/o`, ni `1/l/i`. 31 símbolos.
 */
const ALFABETO = "23456789abcdefghjkmnpqrstuvwxyz";

/**
 * Seis símbolos: 31⁶ ≈ 887 millones de salas.
 *
 * El código **es** la llave: quien lo sepa entra. Lo peor que puede hacer un
 * intruso es pausar la película, así que no hace falta más; pero tampoco
 * menos — con un nombre elegido a mano («casa», «peli») lo adivina cualquiera.
 * Y seis se teclean con el mando sin sufrir.
 */
export const LARGO_CODIGO = 6;

export function crearCodigoSala(aleatorio: (n: number) => Uint8Array = bytesAleatorios): string {
  // Rechazo de los bytes que sesgarían el reparto: 256 no es múltiplo de 31.
  const tope = 256 - (256 % ALFABETO.length);
  let codigo = "";
  while (codigo.length < LARGO_CODIGO) {
    for (const byte of aleatorio(LARGO_CODIGO * 2)) {
      if (byte < tope && codigo.length < LARGO_CODIGO) codigo += ALFABETO[byte % ALFABETO.length];
    }
  }
  return codigo;
}

function bytesAleatorios(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/**
 * Lo que alguien escribe → un código válido, o vacío.
 *
 * Tolera lo que pasa al teclear o dictar: mayúsculas, espacios, guiones, y las
 * letras parecidas que el alfabeto no tiene (una `O` era un `0`, que tampoco
 * está; se deja tal cual y el código sale inválido, que es lo honrado).
 */
export function normalizarCodigo(crudo: string): string {
  const limpio = crudo.toLowerCase().replace(/[\s-]/g, "");
  if (limpio.length !== LARGO_CODIGO) return "";
  for (const letra of limpio) if (!ALFABETO.includes(letra)) return "";
  return limpio;
}

/** El canal privado de Pusher que corresponde a un código. */
export function canalDeSala(codigo: string): string {
  return `private-juntos-${codigo}`;
}

/** Lo único que la ruta de firma acepta firmar. */
export const CANAL_DE_SALA = new RegExp(`^private-juntos-[${ALFABETO}]{${LARGO_CODIGO}}$`);

/**
 * Qué está sonando, según el anfitrión. Es lo que convierte «poner el mismo
 * enlace en los dos aparatos» en «escribir seis letras»: quien entra recibe el
 * vídeo de quien ya está.
 */
export interface VideoDeSala {
  url: string;
  titulo: string;
}

/**
 * Un mensaje de la sala.
 *
 * - `estado`: el reproductor de quien lo manda acaba de cambiar (play, pausa o
 *   salto) o es el pulso periódico del anfitrión. Lleva el estado entero y no
 *   solo la orden: así da igual si se perdió el anterior.
 * - `hola`: alguien acaba de entrar y pide el estado y el vídeo.
 * - `video`: la respuesta del anfitrión a `hola`.
 *
 * Sin hora de envío: la versión anterior compensaba la latencia con
 * `Date.now()` del otro aparato, y el reloj de un televisor puede ir minutos
 * desviado. La latencia real de Pusher (décimas) cabe de sobra en la
 * tolerancia.
 */
export type MensajeSala =
  | { tipo: "estado"; tiempo: number; pausado: boolean; pulso?: boolean }
  | { tipo: "hola" }
  | { tipo: "video"; video: VideoDeSala };

/** Lo que llega por la red, comprobado: un mensaje mal formado se ignora. */
export function leerMensaje(dato: unknown): MensajeSala | null {
  if (!dato || typeof dato !== "object") return null;
  const m = dato as Record<string, unknown>;
  if (m.tipo === "hola") return { tipo: "hola" };
  if (m.tipo === "estado") {
    if (typeof m.tiempo !== "number" || !Number.isFinite(m.tiempo) || m.tiempo < 0) return null;
    if (typeof m.pausado !== "boolean") return null;
    return { tipo: "estado", tiempo: m.tiempo, pausado: m.pausado, pulso: m.pulso === true };
  }
  if (m.tipo === "video") {
    const v = m.video as Record<string, unknown> | undefined;
    // Solo http(s): esta URL acaba en el `src` de un `<video>` de otro aparato.
    if (!v || typeof v.url !== "string" || !/^https?:\/\//i.test(v.url)) return null;
    const titulo = typeof v.titulo === "string" ? v.titulo.slice(0, 200) : "";
    return { tipo: "video", video: { url: v.url, titulo } };
  }
  return null;
}
