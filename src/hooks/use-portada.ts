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

/**
 * Una petición por título y por visita, pase lo que pase con los renders.
 *
 * La lista de títulos cambia varias veces mientras carga la pantalla (llega
 * el estante, llega la película de la sala…), y antes cada cambio cancelaba
 * lo que iba en camino y lo volvía a pedir todo: medido, cinco peticiones por
 * película en ocho segundos. `/api/buscar` comparte el cupo por IP con
 * `/api/pusher/auth`, así que con dos o tres aparatos en la misma casa el
 * cupo se agotaba y **no se podía entrar en la sala** (429).
 *
 * `undefined` = no se sabe (sin TMDB, caído): no se recuerda en disco, pero
 * tampoco se reintenta hasta la próxima visita.
 */
const enCurso = new Map<string, Promise<Arte | null | undefined>>();

function pedirArte(titulo: string): Promise<Arte | null | undefined> {
  const ya = enCurso.get(titulo);
  if (ya) return ya;
  const peticion = fetch(`/api/buscar?q=${encodeURIComponent(titulo.slice(0, 80))}`)
    .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
    .then((datos: { resultados?: unknown; disponible?: boolean } | null) => {
      if (!datos?.disponible) return undefined;
      const encontrado = arteDe(datos.resultados, titulo);
      try {
        const todo = leerRecordado();
        todo[titulo] = { arte: encontrado, en: Date.now() };
        window.localStorage.setItem(CLAVE, JSON.stringify(todo));
      } catch {
        // Sin almacenamiento: se volverá a buscar la próxima vez.
      }
      return encontrado;
    })
    // Sin arte: la portada se ve con el fondo liso.
    .catch(() => undefined);
  enCurso.set(titulo, peticion);
  return peticion;
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

    let vivo = true;
    for (const titulo of new Set(faltan)) {
      pedirArte(titulo).then((encontrado) => {
        if (vivo && encontrado !== undefined) setArte((antes) => ({ ...antes, [titulo]: encontrado }));
      });
    }
    return () => {
      vivo = false;
    };
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
