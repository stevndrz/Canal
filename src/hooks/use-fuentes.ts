"use client";

import { useCallback, useEffect, useState } from "react";
import type { FuentePropia } from "@/lib/fuente-propia/types";
import { claseDeUrl, tituloDesdeUrl } from "@/lib/fuente-propia/url";

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
    return crudo ? (JSON.parse(crudo) as FuentePropia[]) : [];
  } catch {
    // Un JSON corrupto no debe impedir usar la pantalla: se empieza vacío.
    return [];
  }
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

  const anadir = useCallback(
    (url: string, titulo?: string) => {
      const limpia = url.trim();
      const nueva: FuentePropia = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        titulo: titulo?.trim() || tituloDesdeUrl(limpia),
        url: limpia,
        clase: claseDeUrl(limpia),
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
