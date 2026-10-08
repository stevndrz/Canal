"use client";

import { useEffect } from "react";
import { desfaseDeBarras } from "@/lib/viewport-visible";

/**
 * Pone en `<html>` `--vv-arriba` y `--vv-abajo`: cuánto mover las barras fijas
 * del teléfono para que sigan a lo que se ve. Ver `viewport-visible.ts`.
 *
 * Variables y no estilo en línea: así lo aplica la hoja solo en el teléfono,
 * y en el PC y la tele no cambia nada aunque el navegador las ponga.
 */
export function useViewportVisible() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const raiz = document.documentElement;
    let pendiente = 0;
    const medir = () => {
      pendiente = 0;
      const { arriba, abajo } = desfaseDeBarras({
        offsetTop: vv.offsetTop,
        height: vv.height,
        scale: vv.scale,
        innerHeight: window.innerHeight,
      });
      raiz.style.setProperty("--vv-arriba", `${arriba}px`);
      raiz.style.setProperty("--vv-abajo", `${abajo}px`);
    };
    // Una vez por fotograma como mucho: `scroll` del viewport llega a ráfagas.
    const pedir = () => {
      if (!pendiente) pendiente = window.requestAnimationFrame(medir);
    };
    vv.addEventListener("resize", pedir);
    vv.addEventListener("scroll", pedir);
    window.addEventListener("scroll", pedir, { passive: true });
    medir();
    return () => {
      vv.removeEventListener("resize", pedir);
      vv.removeEventListener("scroll", pedir);
      window.removeEventListener("scroll", pedir);
      if (pendiente) window.cancelAnimationFrame(pendiente);
      raiz.style.removeProperty("--vv-arriba");
      raiz.style.removeProperty("--vv-abajo");
    };
  }, []);
}
