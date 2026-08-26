/**
 * ¿Este navegador sabe separar con `gap` dentro de un flex?
 *
 * **El `gap` de flexbox es de Chromium 84.** El parque al que apunta esta app:
 *
 * | Sistema               | Chromium     | ¿`gap` en flex? |
 * |-----------------------|--------------|-----------------|
 * | webOS 4 / 5 / 6       | 53 / 68 / 79 | **no**          |
 * | Tizen 4.0 / 5.5 / 6.0 | 56 / 69 / 76 | **no**          |
 * | Tizen 6.5 / 7         | 85 / 94      | sí              |
 *
 * O sea: en los televisores de casa **todos los huecos de flex valen cero** y
 * los botones, las píldoras y los destinos de la barra se tocan entre sí. Hay
 * setenta y siete sitios así en el proyecto, y no se había visto nunca porque
 * no hay forma de probar en esos aparatos.
 *
 * `@supports` no sirve para averiguarlo: `gap` es válido para *grid* desde
 * mucho antes, así que un navegador sin `gap` en flex responde que sí lo
 * soporta. La única comprobación honesta es medirlo.
 *
 * Vive aparte del componente para poder ejecutarla contra un documento
 * simulado en las pruebas, sin navegador.
 */
export function soportaGapEnFlex(documento: Document): boolean {
  const cuerpo = documento.body;
  // Llamado antes de que exista el cuerpo no se puede medir nada. Se responde
  // que sí: el respaldo solo AÑADE márgenes, y añadirlos de más en un
  // navegador moderno se vería peor que no ponerlos en uno viejo.
  if (!cuerpo) return true;

  const caja = documento.createElement("div");
  caja.style.display = "flex";
  caja.style.gap = "1px";
  // Fuera de la vista y sin afectar a la maquetación de nadie.
  caja.style.position = "absolute";
  caja.style.visibility = "hidden";
  caja.appendChild(documento.createElement("div"));
  caja.appendChild(documento.createElement("div"));

  cuerpo.appendChild(caja);
  // Dos hijos vacíos y un hueco de 1px: con soporte el contenido mide 1px, sin
  // soporte mide 0.
  const soporta = caja.scrollWidth === 1;
  cuerpo.removeChild(caja);

  return soporta;
}
