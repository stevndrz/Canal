"use client";

import { useCallback, useEffect, useState } from "react";
import type { FuentePropia } from "@/lib/fuente-propia/types";
import { claseDeUrl, tituloDesdeUrl, urlUtilizable } from "@/lib/fuente-propia/url";

const CLAVE = "canalcasa:fuentes";

/**
 * Las fuentes propias, guardadas en este dispositivo.
 *
 * Mismo criterio que favoritos y recientes: `localStorage` y nada más. No hay
 * cuenta ni base de datos en toda la app, y un enlace que alguien pega en su
 * casa no tiene por qué salir de ahí.
 *
 * Se lee en un efecto y no durante el render porque `localStorage` no existe en
 * el servidor: leerlo antes del montaje rompería la hidratación.
 */
function leerGuardadas(): FuentePropia[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const guardadas = JSON.parse(crudo) as unknown;
    if (!Array.isArray(guardadas)) return [];
    return guardadas.filter(esFuenteUtilizable);
  } catch {
    // Un JSON corrupto no debe impedir usar la pantalla: se empieza vacío.
    return [];
  }
}

/**
 * Lo guardado se vuelve a comprobar al leerlo, no solo al escribirlo.
 *
 * `resolverFuente` ya filtra al dar de alta, así que lo que hay aquí debería
 * estar bien. «Debería» es la palabra: esto sale de `localStorage`, que es
 * texto que puede haber escrito otra versión de la app con otras reglas, la
 * consola del navegador, o una extensión. Y de aquí la `url` va derecha al
 * `src` de un `<video>` y a `hls.loadSource()`.
 *
 * Es la misma disciplina que el resto del proyecto aplica a la lista M3U y a
 * los addons de Stremio —comprobar el esquema en el borde, no confiar en que
 * ya venía comprobado— aplicada al borde que faltaba. Lo que no pase se
 * descarta en silencio: quien tenga una entrada corrupta ve una fuente menos,
 * no una pantalla rota.
 */
function esFuenteUtilizable(fuente: unknown): fuente is FuentePropia {
  if (typeof fuente !== "object" || fuente === null) return false;
  const { id, titulo, url } = fuente as Partial<FuentePropia>;
  return (
    typeof id === "string" &&
    typeof titulo === "string" &&
    typeof url === "string" &&
    urlUtilizable(url)
  );
}

export function useFuentes() {
  const [fuentes, setFuentes] = useState<FuentePropia[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    // `localStorage` no existe en el render de servidor, así que la
    // hidratación inicial solo puede ocurrir después del montaje. Es el mismo
    // patrón que `use-persisted-set.ts` y por el mismo motivo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFuentes(leerGuardadas());
    setCargado(true);
  }, []);

  const guardar = useCallback((siguiente: FuentePropia[]) => {
    setFuentes(siguiente);
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(siguiente));
    } catch {
      // Modo privado o cuota llena: la sesión sigue funcionando en memoria.
    }
  }, []);

  /**
   * Añade una fuente ya resuelta.
   *
   * Recibe la URL reproducible, no lo que se escribió: con un magnet las dos
   * cosas son distintas y quien resuelve esa diferencia es `resolverFuente`,
   * en un solo sitio. Aquí solo se guarda.
   */
  const anadir = useCallback(
    (url: string, titulo?: string, magnet?: string) => {
      const limpia = url.trim();
      const nueva: FuentePropia = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        // Con un magnet el nombre bueno está en el magnet (`dn=`), no en la
        // URL de la réplica, que suele ser un hash.
        titulo: titulo?.trim() || tituloDesdeUrl(magnet ?? limpia),
        url: limpia,
        clase: magnet ? "magnet" : claseDeUrl(limpia),
        ...(magnet ? { magnet } : {}),
        creadaEn: Date.now(),
      };
      // La última añadida va primero: es la que se acaba de pegar y la que se
      // quiere ver ahora.
      setFuentes((actuales) => {
        const siguiente = [nueva, ...actuales.filter((f) => f.url !== limpia)];
        try {
          window.localStorage.setItem(CLAVE, JSON.stringify(siguiente));
        } catch {
          /* ver `guardar` */
        }
        return siguiente;
      });
      return nueva;
    },
    [],
  );

  const quitar = useCallback(
    (id: string) => guardar(fuentes.filter((fuente) => fuente.id !== id)),
    [fuentes, guardar],
  );

  return { fuentes, cargado, anadir, quitar };
}
