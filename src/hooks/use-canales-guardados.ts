"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Channel } from "@/lib/types";
import { claveDeId, idsDeClaves, idsEnOrden, leerGuardado, migrarIdsAClaves } from "@/lib/claves-canal";

/**
 * Favoritos y recientes de canales, guardados por CLAVE ESTABLE
 * (`claves-canal.ts`) y no por posición en la lista.
 *
 * Hacia fuera la forma no cambia — `ids: Set<number>`, `toggle(id)`… — para
 * que ningún componente tenga que enterarse: la traducción clave ↔ id se hace
 * aquí, contra la lista que haya en ese momento.
 *
 * **Migración.** Lo viejo vive en `canalcasa:favorites` / `canalcasa:recents`
 * (ids). Lo nuevo, en `canalcasa:favoritos` / `canalcasa:recientes` (claves).
 * Mientras no se haya podido migrar, todo funciona exactamente como antes,
 * leyendo y escribiendo lo viejo. En cuanto la lista permite traducir sin
 * perder nada (`migrarIdsAClaves`), se escribe lo nuevo y desde entonces solo
 * se usa eso. **Lo viejo no se borra**: queda como copia de seguridad en el
 * aparato por si algo saliera mal.
 */

type Estado = { claves: string[] } | { ids: number[] };

function leer(nueva: string, vieja: string): Estado {
  try {
    const nuevo = leerGuardado(window.localStorage.getItem(nueva));
    if (nuevo && "claves" in nuevo) return nuevo;
    const viejo = leerGuardado(window.localStorage.getItem(vieja));
    if (viejo && "ids" in viejo) return viejo;
  } catch {
    /* almacenamiento bloqueado (modo privado en webOS) */
  }
  return { claves: [] };
}

function escribir(clave: string, valor: unknown) {
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin persistencia: la sesión sigue funcionando */
  }
}

/**
 * El estado guardado, migrado en cuanto se puede. Compartido por favoritos y
 * recientes: lo único que cambia es qué se hace con la lista.
 */
function useGuardado(nueva: string, vieja: string, channels: readonly Channel[], listaCompleta: boolean) {
  const [estado, setEstado] = useState<Estado>({ claves: [] });

  useEffect(() => {
    // localStorage no existe en el render de servidor: se lee al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado(leer(nueva, vieja));
  }, [nueva, vieja]);

  useEffect(() => {
    if (!("ids" in estado)) return;
    const claves = migrarIdsAClaves(estado.ids, channels, listaCompleta);
    if (claves === null) return;
    escribir(nueva, claves);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado({ claves });
  }, [estado, channels, listaCompleta, nueva]);

  return [estado, setEstado] as const;
}

export function useFavoritosDeCanal(channels: readonly Channel[], listaCompleta: boolean) {
  const NUEVA = "canalcasa:favoritos";
  const VIEJA = "canalcasa:favorites";
  const [estado, setEstado] = useGuardado(NUEVA, VIEJA, channels, listaCompleta);

  const ids = useMemo(
    () => ("claves" in estado ? idsDeClaves(estado.claves, channels) : new Set(estado.ids)),
    [estado, channels],
  );

  const toggle = useCallback(
    (id: number) => {
      setEstado((actual) => {
        if ("ids" in actual) {
          // Aún sin migrar: igual que siempre, sobre el formato viejo.
          const siguiente = actual.ids.includes(id) ? actual.ids.filter((v) => v !== id) : [...actual.ids, id];
          escribir(VIEJA, siguiente);
          return { ids: siguiente };
        }
        const clave = claveDeId(channels, id);
        if (clave === null) return actual;
        const siguiente = actual.claves.includes(clave)
          ? actual.claves.filter((v) => v !== clave)
          : [...actual.claves, clave];
        escribir(NUEVA, siguiente);
        return { claves: siguiente };
      });
    },
    [channels, setEstado],
  );

  /** Borrar es una decisión de la persona (Ajustes): vacía los dos formatos. */
  const clear = useCallback(() => {
    escribir(NUEVA, []);
    escribir(VIEJA, []);
    setEstado({ claves: [] });
  }, [setEstado]);

  return useMemo(() => ({ ids, toggle, clear }), [ids, toggle, clear]);
}

/** Lista ordenada por uso reciente (los últimos vistos primero). */
export function useRecientesDeCanal(channels: readonly Channel[], listaCompleta: boolean, limite = 12) {
  const NUEVA = "canalcasa:recientes";
  const VIEJA = "canalcasa:recents";
  const [estado, setEstado] = useGuardado(NUEVA, VIEJA, channels, listaCompleta);

  const ids = useMemo(
    () => ("claves" in estado ? idsEnOrden(estado.claves, channels) : estado.ids),
    [estado, channels],
  );

  const push = useCallback(
    (id: number) => {
      setEstado((actual) => {
        if ("ids" in actual) {
          const siguiente = [id, ...actual.ids.filter((v) => v !== id)].slice(0, limite);
          escribir(VIEJA, siguiente);
          return { ids: siguiente };
        }
        const clave = claveDeId(channels, id);
        if (clave === null) return actual;
        if (actual.claves[0] === clave) return actual;
        const siguiente = [clave, ...actual.claves.filter((v) => v !== clave)].slice(0, limite);
        escribir(NUEVA, siguiente);
        return { claves: siguiente };
      });
    },
    [channels, limite, setEstado],
  );

  /**
   * El objeto, memorizado. Devolver `{ ids, push }` a pelo creaba una identidad
   * nueva en cada render, y eso llegaba lejos: cambiaba `select` en
   * `dashboard.tsx`, con él el `onOpen` de las tarjetas, y el comparador de
   * `memo(MediaCard)` dejaba de acertar. Medido: 121 tarjetas repintadas por
   * sintonizar un canal.
   */
  return useMemo(() => ({ ids, push }), [ids, push]);
}
