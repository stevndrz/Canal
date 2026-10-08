/**
 * Elegir el tamaño de una imagen de TMDB según la pantalla.
 *
 * TMDB sirve cada imagen en tamaños fijos (`w300`, `w780`, `w1280`…) solo
 * cambiando un trozo de la URL, así que no hace falta optimizador: basta con
 * ofrecerle al navegador las opciones (`srcset`) y decirle cuánto ocupa la
 * imagen (`sizes`) para que pida la justa.
 *
 * Medido antes de tocar nada (Playwright, iPhone 390 px a 3×, PC y tele a
 * 1920): las carátulas YA estaban bien con `w342` —en el iPhone miden 173 px,
 * o sea 519 px reales: `w342` va incluso por debajo—, así que esas no cambian.
 * Lo que se derrochaba era el fondo del héroe y de la ficha: `w1280` (≈170 KB)
 * en un teléfono, donde `w780` (≈45 KB) se ve igual detrás del degradado.
 */

const TAMANO = /\/t\/p\/[a-z0-9]+\//;

/** La misma imagen de TMDB en otro tamaño. Si no es de TMDB, tal cual. */
export function enTamano(url: string, tamano: string): string {
  return url.replace(TAMANO, `/t/p/${tamano}/`);
}

export function esDeTmdb(url: string): boolean {
  return url.includes("image.tmdb.org") && TAMANO.test(url);
}

/**
 * Un fondo a todo lo ancho: `w780` en el teléfono, `w1280` en lo demás.
 *
 * El `sizes` es un truco consciente: en el teléfono se declara 260 px para
 * que a 3× salga justo `w780`. Declarando el ancho real (100vw = 390 px × 3)
 * el navegador volvería a elegir `w1280`, que es lo que se quiere evitar.
 */
export function fondoResponsivo(url: string): { src: string; srcSet?: string; sizes?: string } {
  if (!esDeTmdb(url)) return { src: url };
  const grande = enTamano(url, "w1280");
  return {
    src: grande,
    srcSet: `${enTamano(url, "w780")} 780w, ${grande} 1280w`,
    sizes: "(max-width: 700px) 260px, 100vw",
  };
}
