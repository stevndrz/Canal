"use client";

import { useEffect, useState } from "react";
import type { CardItem } from "@/lib/media-item";
import type { MediaType } from "@/lib/catalog/types";
import { leerRespuestaBusqueda, type EstadoBusqueda } from "@/lib/catalog/busqueda";

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
  const [respuesta, setRespuesta] = useState<{
    para: string;
    fichas: TituloEncontrado[];
    estado: EstadoBusqueda;
  }>({ para: "", fichas: [], estado: "ok" });
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
        .then(async (http) => {
          // El cuerpo se lee aunque el estado no sea 2xx: un 503 trae
          // `disponible: false` y un 429 su propio aviso. Ver `busqueda.ts`.
          const cuerpo: unknown = await http.json().catch(() => null);
          const leida = leerRespuestaBusqueda<TituloEncontrado>(http.status, cuerpo);
          setRespuesta({ para: limpia, fichas: leida.resultados, estado: leida.estado });
          setCargando(false);
        })
        .catch(() => {
          // `AbortError` es lo normal aquí —una tecla más—, no un fallo. Si
          // fue la red, se dice «no disponible» para ESTA consulta: sin
          // anotarla, `pendiente` se quedaría encendido para siempre y el
          // esqueleto no se iría nunca.
          if (control.signal.aborted) return;
          setRespuesta({ para: limpia, fichas: [], estado: "no-disponible" });
          setCargando(false);
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
   *
   * `pendiente` es la otra cara del punto 2: hay algo escrito que se puede
   * buscar y todavía no hay respuesta PARA ESO. Cubre el antirrebote y la red
   * a la vez, y es lo que evita el parpadeo de «Sin resultados» entre tecla y
   * tecla: medido, con «spi» decía «Sin resultados» a los 100 ms y tenía 16
   * títulos a los 2,6 s. Mientras está pendiente se enseña el esqueleto.
   */
  const alDia = buscable && respuesta.para === limpia;
  const resultados = alDia ? respuesta.fichas : [];
  const pendiente = buscable && !alDia;

  return {
    resultados,
    cargando: buscable && cargando,
    pendiente,
    /** Hay al menos dos letras: con menos no se pregunta a nadie. */
    buscable,
    /** Cómo fue la última respuesta para lo que hay escrito. */
    estado: alDia ? respuesta.estado : ("ok" as EstadoBusqueda),
  };
}
