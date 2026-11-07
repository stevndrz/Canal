"use client";

import { useEffect, useState } from "react";
import { arteDe, audiosDelMaster, type Arte } from "@/lib/ver-juntos/portada";

/**
 * El arte de TMDB de «Nuestras películas», buscado por su título.
 *
 * Pasa por `/api/buscar` porque la credencial de TMDB no sale al navegador.
 * Se recuerda en `localStorage` una semana: el póster de una película no
 * cambia, y la tele no tiene que volver a pedirlo cada vez que abre Mi enlace.
 * Sin TMDB (sin clave, caído) no se recuerda nada y la portada va sin imagen.
 */
const CLAVE = "canalcasa:arte-peliculas";
const DURA_MS = 7 * 24 * 3600_000;

type Recordado = Record<string, { arte: Arte | null; en: number }>;

function leerRecordado(): Recordado {
  try {
    return (JSON.parse(window.localStorage.getItem(CLAVE) ?? "{}") as Recordado) ?? {};
  } catch {
    return {};
  }
}

export function useArte(titulos: readonly string[]): Record<string, Arte | null> {
  const [arte, setArte] = useState<Record<string, Arte | null>>({});
  const clave = titulos.join("\u0000");

  useEffect(() => {
    const lista = clave ? clave.split("\u0000") : [];
    const recordado = leerRecordado();
    const ahora = Date.now();
    const yaSabido: Record<string, Arte | null> = {};
    const faltan: string[] = [];
    for (const titulo of lista) {
      const r = recordado[titulo];
      if (r && ahora - r.en < DURA_MS) yaSabido[titulo] = r.arte;
      else faltan.push(titulo);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `localStorage` solo existe tras montar.
    setArte(yaSabido);
    if (faltan.length === 0) return;

    const controlador = new AbortController();
    for (const titulo of faltan) {
      fetch(`/api/buscar?q=${encodeURIComponent(titulo.slice(0, 80))}`, { signal: controlador.signal })
        .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
        .then((datos: { resultados?: unknown; disponible?: boolean } | null) => {
          if (!datos?.disponible) return;
          const encontrado = arteDe(datos.resultados, titulo);
          setArte((antes) => ({ ...antes, [titulo]: encontrado }));
          try {
            const todo = leerRecordado();
            todo[titulo] = { arte: encontrado, en: Date.now() };
            window.localStorage.setItem(CLAVE, JSON.stringify(todo));
          } catch {
            // Sin almacenamiento: se volverá a buscar la próxima vez.
          }
        })
        .catch(() => {
          // Sin arte: la portada se ve con el fondo liso.
        });
    }
    return () => controlador.abort();
  }, [clave]);

  return arte;
}

/** Los nombres de los audios de un HLS. Vacío mientras no se sepan. */
export function useAudios(url: string | undefined): string[] {
  const [audios, setAudios] = useState<{ url: string; lista: string[] }>({ url: "", lista: [] });
  useEffect(() => {
    if (!url || !/\.m3u8(\?|$)/i.test(url)) return;
    const controlador = new AbortController();
    fetch(url, { signal: controlador.signal })
      .then((respuesta) => (respuesta.ok ? respuesta.text() : ""))
      .then((texto) => setAudios({ url, lista: audiosDelMaster(texto) }))
      .catch(() => {});
    return () => controlador.abort();
  }, [url]);
  return audios.url === url ? audios.lista : [];
}
