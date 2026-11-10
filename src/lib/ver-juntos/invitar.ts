/**
 * Invitar a la sala: el enlace que entra directo, lo que se comparte con él y
 * el dibujo del código QR que la tele enseña para escanearlo con el teléfono.
 * Puro: quien toca el navegador (compartir, copiar, pintar) es la vista.
 */

/** `https://…/?sala=8047`: lo abre `dashboard.tsx` en Mi enlace, y `fuente-view.tsx` entra. */
export function enlaceDeSala(origen: string, codigo: string): string {
  return `${origen.replace(/\/+$/, "")}/?sala=${codigo}`;
}

export function textoDeInvitacion(titulo: string | undefined, codigo: string): string {
  return titulo ? `Veamos «${titulo}» juntos en CanalCasa. Sala ${codigo}.` : `Entra a mi sala de CanalCasa: ${codigo}.`;
}

/**
 * Los módulos de un QR → un solo trazo de SVG.
 *
 * `margen` son los módulos en blanco alrededor: sin esa «zona tranquila» (4,
 * según la norma) muchas cámaras no lo leen. Cada tirada de módulos oscuros
 * seguidos es un rectángulo: menos nodos que uno por módulo, que en una tele
 * vieja se nota al pintar.
 */
export function trazoDeQr(oscuro: (fila: number, columna: number) => boolean, modulos: number, margen = 4): { lado: number; d: string } {
  let d = "";
  for (let f = 0; f < modulos; f++) {
    let desde = -1;
    for (let c = 0; c <= modulos; c++) {
      const es = c < modulos && oscuro(f, c);
      if (es && desde < 0) desde = c;
      else if (!es && desde >= 0) {
        d += `M${desde + margen} ${f + margen}h${c - desde}v1h-${c - desde}z`;
        desde = -1;
      }
    }
  }
  return { lado: modulos + margen * 2, d };
}
