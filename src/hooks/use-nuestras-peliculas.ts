"use client";

import { useEffect, useState } from "react";
import { publicConfig } from "@/lib/config";
import { leerCatalogo, rutaCatalogo, type PeliculaNuestra } from "@/lib/ver-juntos/catalogo";

/**
 * El catálogo de «Nuestras películas», leído al montar.
 *
 * `no-store`: el script de subida lo reescribe y lo marca `no-cache`; una
 * película recién subida tiene que salir al abrir la pantalla, no a los cinco
 * minutos.
 */
export function useNuestrasPeliculas() {
  const base = publicConfig.peliculasUrl;
  const [estado, setEstado] = useState<{ peliculas: PeliculaNuestra[]; listo: boolean; fallo: boolean }>({
    peliculas: [],
    listo: !base,
    fallo: false,
  });

  useEffect(() => {
    if (!base) return;
    const controlador = new AbortController();
    fetch(rutaCatalogo(base), { cache: "no-store", signal: controlador.signal })
      .then((respuesta) => {
        // Sin catálogo todavía (nada subido) no es un fallo: es una lista vacía.
        if (respuesta.status === 404) return { peliculas: [] };
        if (!respuesta.ok) throw new Error(String(respuesta.status));
        return respuesta.json();
      })
      .then((json) => setEstado({ peliculas: leerCatalogo(json), listo: true, fallo: false }))
      .catch((error) => {
        if (controlador.signal.aborted) return;
        console.warn("Nuestras películas: no se pudo leer el catálogo", error);
        setEstado({ peliculas: [], listo: true, fallo: true });
      });
    return () => controlador.abort();
  }, [base]);

  return { ...estado, configurado: Boolean(base) };
}
