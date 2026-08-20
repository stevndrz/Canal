"use client";

import { useEffect, useState } from "react";
import type { CardItem } from "@/lib/media-item";
import type { MediaType } from "@/lib/catalog/types";

/** Una ficha de resultado, con lo que hace falta para abrirla. */
export interface TituloEncontrado extends CardItem {
  mediaType: MediaType;
  id: string;
}

/**
 * Películas y series que coinciden con lo escrito.
 *
 * Dos cosas que no son opcionales cuando se busca mientras se teclea:
 *
 *  - **Antirrebote.** Sin él, "batman" son seis peticiones y cinco se tiran.
 *    250 ms es el hueco entre pulsaciones de alguien escribiendo de corrido.
 *  - **Cancelación.** Las respuestas pueden llegar desordenadas: si la de
 *    "bat" tarda más que la de "batman", sin cancelar se pintarían los
 *    resultados de "bat" sobre los de "batman" y la lista parecería ir por
 *    detrás de lo que se escribe. `AbortController` corta la anterior en cada
 *    tecla.
 */
export function useBuscarTitulos(consulta: string) {
  const [respuesta, setRespuesta] = useState<{ para: string; fichas: TituloEncontrado[] }>({
    para: "",
    fichas: [],
  });
  const [cargando, setCargando] = useState(false);

  const limpia = consulta.trim();
  const buscable = limpia.length >= 2;

  useEffect(() => {
    if (!buscable) return;

    const control = new AbortController();

    // El «buscando…» se enciende cuando de verdad sale la petición, no al
    // pulsar la tecla: durante los 250 ms de antirrebote la persona sigue
    // escribiendo y no hay nada en marcha todavía. De paso evita escribir
    // estado durante el efecto, que es lo que pide `set-state-in-effect`.
    const temporizador = setTimeout(() => {
      setCargando(true);
      fetch(`/api/buscar?q=${encodeURIComponent(limpia)}`, { signal: control.signal })
        .then((respuesta) => respuesta.json())
        .then((datos: { resultados: TituloEncontrado[] }) => {
          setRespuesta({ para: limpia, fichas: datos.resultados ?? [] });
          setCargando(false);
        })
        .catch(() => {
          // `AbortError` es lo normal aquí —una tecla más—, no un fallo. Y si
          // fue un fallo de red, la mitad de canales sigue funcionando.
          if (!control.signal.aborted) setCargando(false);
        });
    }, 250);

    return () => {
      clearTimeout(temporizador);
      control.abort();
    };
  }, [limpia, buscable]);

  /**
   * Lo que se devuelve se **deriva** en el render en vez de guardarse en un
   * efecto. Dos motivos, y el segundo importa más que el primero:
   *
   *  1. Vaciar la lista con `setResultados([])` al borrar el texto es escribir
   *     estado durante un efecto para algo que ya se sabe al pintar.
   *  2. Al cambiar la consulta, el estado todavía guarda las fichas de la
   *     anterior. Comparando `para` con lo que hay escrito ahora, los
   *     resultados viejos desaparecen en el mismo fotograma en que se teclea,
   *     en lugar de quedarse debajo del texto nuevo hasta que llegue la
   *     respuesta.
   */
  const resultados = buscable && respuesta.para === limpia ? respuesta.fichas : [];

  return { resultados, cargando: buscable && cargando };
}
