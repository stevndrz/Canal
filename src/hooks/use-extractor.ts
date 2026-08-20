"use client";

import { useCallback, useRef, useState } from "react";

/** En qué punto está la extracción, para que la interfaz pueda contarlo. */
export type EstadoExtraccion =
  | { fase: "quieto" }
  | { fase: "buscando" }
  | { fase: "listo"; url: string }
  | { fase: "fallo"; motivo: string };

/**
 * Pide el enlace directo de una película, en el momento del clic.
 *
 * Tarda entre 10 y 30 segundos porque al otro lado hay un navegador recorriendo
 * una cadena de páginas. Eso condiciona toda la interacción:
 *
 *  - **Hay que decir que está pasando algo.** Medio minuto sin respuesta se
 *    lee como «se rompió», y la persona pulsa otra vez.
 *  - **No se puede pulsar dos veces.** Cada intento abre una pestaña real en la
 *    otra máquina; con `enCurso` se ignora el segundo clic en vez de duplicar
 *    el trabajo.
 *  - **El motivo del fallo se enseña tal cual lo manda el servicio.** «No se
 *    pudo» a secas no distingue entre el servicio apagado, el sitio caído o
 *    esa película sin descarga directa, y cada caso se arregla distinto.
 */
export function useExtractor() {
  const [estado, setEstado] = useState<EstadoExtraccion>({ fase: "quieto" });
  const enCurso = useRef(false);

  const extraer = useCallback(async (titulo: string, anio?: string | null) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setEstado({ fase: "buscando" });

    try {
      const parametros = new URLSearchParams({ titulo });
      if (anio) parametros.set("anio", anio);
      const respuesta = await fetch(`/api/extraer?${parametros}`);
      const datos: { estado: string; url?: string; motivo?: string } = await respuesta.json();

      if (datos.estado === "ok" && datos.url) {
        setEstado({ fase: "listo", url: datos.url });
      } else {
        setEstado({
          fase: "fallo",
          motivo: datos.motivo ?? "No se pudo obtener el enlace.",
        });
      }
    } catch {
      setEstado({ fase: "fallo", motivo: "No hubo respuesta del servidor." });
    } finally {
      enCurso.current = false;
    }
  }, []);

  const reiniciar = useCallback(() => setEstado({ fase: "quieto" }), []);

  return { estado, extraer, reiniciar };
}
