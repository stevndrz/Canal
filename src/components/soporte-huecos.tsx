"use client";

import { useLayoutEffect } from "react";
import { soportaGapEnFlex } from "@/lib/soporte-gap";

/**
 * Marca el documento cuando el navegador no sabe de `gap` en flexbox.
 *
 * Ver `soporte-gap.ts` para el porqué y la tabla de versiones. Con la marca
 * puesta, `globals.css` restaura los huecos con márgenes en las piezas donde
 * se nota.
 *
 * **Por defecto se asume que SÍ hay soporte**, y la marca solo aparece si la
 * comprobación falla. Al revés habría un parpadeo de doble espaciado en todos
 * los navegadores modernos, que son la mayoría; así el único coste es un
 * instante apretado en los televisores viejos, donde hoy está apretado
 * siempre.
 *
 * `useLayoutEffect` y no `useEffect`: corre antes de que el navegador pinte,
 * así que ni siquiera ese instante llega a verse en la práctica.
 */
export function SoporteHuecos() {
  useLayoutEffect(() => {
    if (soportaGapEnFlex(document)) return;
    document.documentElement.dataset.sinGap = "1";
  }, []);

  return null;
}
