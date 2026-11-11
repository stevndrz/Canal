"use client";

import { useEffect } from "react";
import { desfaseDeBarras, estaRebotando } from "@/lib/viewport-visible";

/**
 * Pone en `<html>` `--vv-arriba` y `--vv-abajo`: cuánto mover las barras fijas
 * del teléfono para que sigan a lo que se ve. Ver `viewport-visible.ts`.
 *
 * Solo corrige alrededor del teclado: mientras hay un campo de texto con el
 * foco y, al soltarlo, hasta que la persona vuelve a mover la página. Y nunca
 * con la página rebotando. Fuera de eso deja las barras en paz.
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
    /** Hubo teclado y la página no se ha movido desde entonces. */
    let trasTeclado = false;
    const esCampo = (objetivo: EventTarget | null) =>
      objetivo instanceof HTMLElement && (objetivo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(objetivo.tagName));
    const medir = () => {
      pendiente = 0;
      const { arriba, abajo } = desfaseDeBarras({
        offsetTop: vv.offsetTop,
        height: vv.height,
        scale: vv.scale,
        innerHeight: window.innerHeight,
        trasTeclado,
        rebote: estaRebotando(window.scrollY, raiz.scrollHeight, window.innerHeight),
      });
      raiz.style.setProperty("--vv-arriba", `${arriba}px`);
      raiz.style.setProperty("--vv-abajo", `${abajo}px`);
    };
    // Una vez por fotograma como mucho: `scroll` del viewport llega a ráfagas.
    const pedir = () => {
      if (!pendiente) pendiente = window.requestAnimationFrame(medir);
    };
    const alEnfocar = (evento: FocusEvent) => {
      if (!esCampo(evento.target)) return;
      trasTeclado = true;
      pedir();
    };
    // Al mover la página con el dedo sin estar escribiendo, Safari recoloca lo
    // visible por su cuenta: la corrección ya sobra (y estorbaría al rebotar).
    const alArrastrar = () => {
      if (!trasTeclado || esCampo(document.activeElement)) return;
      trasTeclado = false;
      pedir();
    };
    document.addEventListener("focusin", alEnfocar);
    document.addEventListener("touchmove", alArrastrar, { passive: true });
    vv.addEventListener("resize", pedir);
    vv.addEventListener("scroll", pedir);
    window.addEventListener("scroll", pedir, { passive: true });
    medir();
    return () => {
      document.removeEventListener("focusin", alEnfocar);
      document.removeEventListener("touchmove", alArrastrar);
      vv.removeEventListener("resize", pedir);
      vv.removeEventListener("scroll", pedir);
      window.removeEventListener("scroll", pedir);
      if (pendiente) window.cancelAnimationFrame(pendiente);
      raiz.style.removeProperty("--vv-arriba");
      raiz.style.removeProperty("--vv-abajo");
    };
  }, []);
}
