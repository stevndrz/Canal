import type { Region } from "@/lib/origenes";
import { regionDePais } from "@/lib/origenes";
import { normalizeChannelName, normalizeText } from "@/lib/text";

/**
 * El número de cada canal: el que se marca con el mando y se lee en la lista.
 *
 * Antes salía de la centena de la categoría (Guatemala 1xx, Deportes 2xx…)
 * más el orden dentro de ella, y con 4.816 canales eso daba **885 números
 * repetidos**: las categorías de más de 99 se desbordaban a la centena
 * siguiente, y marcar «826» podía llevar a dos canales distintos. Propuesta y
 * tabla completa en `docs/equipo/numeracion.md`; aprobada por el
 * dueño el 2026-10-08.
 *
 * 1. **Fijos** para los de Guatemala que se marcan de memoria: el número de
 *    la tele de siempre. No cambian nunca.
 * 2. **Un bloque por región**, en el orden de las secciones de Canales, con
 *    hueco de sobra para crecer.
 * 3. Dentro de cada bloque, **por nombre**. Un canal nuevo solo corre los de
 *    detrás en SU bloque; ni otros bloques ni los fijos se mueven.
 *
 * El orden es por texto normalizado y comparación simple, NO `Intl.Collator`:
 * el recorte del HTML lo numera el servidor y la lista completa la numera el
 * aparato, y un colador de una tele de 2019 no ordena igual que el de Node.
 * Con la comparación simple los dos dan exactamente el mismo número.
 */

/** Dónde empieza el bloque de cada región. */
export const INICIO_DE_BLOQUE: Record<Region, number> = {
  guatemala: 30,
  centroamerica: 100,
  mexico: 300,
  caribe: 500,
  sudamerica: 1000,
  espana: 2000,
  eeuu: 3000,
  mundo: 5000,
  "sin-pais": 9000,
};

/** Dónde se acaba (incluido). Pasarse no rompe nada, pero lo vigila la prueba. */
export const FIN_DE_BLOQUE: Record<Region, number> = {
  guatemala: 99,
  centroamerica: 299,
  mexico: 499,
  caribe: 799,
  sudamerica: 1999,
  espana: 2499,
  eeuu: 4999,
  mundo: 8999,
  "sin-pais": 9999,
};

/**
 * Los fijos, por nombre normalizado. Solo cuentan para canales de Guatemala:
 * el Canal 3 de Argentina sigue en su bloque. Hay hueco del 1 al 29 para
 * añadir más (Canal 11, Canal 13…) cuando aparezcan en la lista.
 */
export const FIJOS_DE_GUATEMALA: ReadonlyMap<string, number> = new Map([
  ["canal3", 3],
  ["canal7", 7],
  ["tn23", 23],
  ["guatevision", 25],
]);

/** Lo mínimo de un canal para numerarlo. */
export interface ParaNumerar {
  nombre: string;
  /** Código ISO del país (`gt`, `mx`…) o vacío. */
  pais: string;
  /** Para desempatar dos canales con el mismo nombre en la misma región. */
  url: string;
}

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Orden «natural» sin colador: cada tramo de cifras se rellena con ceros, así
 * «Canal 13» va antes que «Canal 100» y la comparación sigue siendo letra a
 * letra, igual en cualquier navegador.
 */
const CIFRAS = /\d+/g;
const claveNatural = (texto: string) => texto.replace(CIFRAS, (cifras) => cifras.padStart(8, "0"));

/** El número de cada canal, en el mismo orden en que llegan. */
export function numerarCanales(canales: readonly ParaNumerar[]): number[] {
  const numeros = new Array<number>(canales.length);
  const porRegion = new Map<Region, { indice: number; clave: string; nombre: string; url: string }[]>();
  const fijosUsados = new Set<number>();

  canales.forEach((canal, indice) => {
    const region = regionDePais(canal.pais);
    if (region === "guatemala") {
      const fijo = FIJOS_DE_GUATEMALA.get(normalizeChannelName(canal.nombre));
      // El primero con ese nombre se queda el fijo; si la lista trae dos, el
      // segundo va al bloque como cualquier otro.
      if (fijo !== undefined && !fijosUsados.has(fijo)) {
        fijosUsados.add(fijo);
        numeros[indice] = fijo;
        return;
      }
    }
    const lista = porRegion.get(region) ?? [];
    lista.push({ indice, clave: claveNatural(normalizeText(canal.nombre).trim()), nombre: canal.nombre, url: canal.url });
    porRegion.set(region, lista);
  });

  for (const [region, lista] of porRegion) {
    lista.sort((a, b) => comparar(a.clave, b.clave) || comparar(a.nombre, b.nombre) || comparar(a.url, b.url));
    lista.forEach(({ indice }, i) => {
      numeros[indice] = INICIO_DE_BLOQUE[region] + i;
    });
  }
  return numeros;
}
