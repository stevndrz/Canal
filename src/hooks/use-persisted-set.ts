"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Set de ids en localStorage. Sin cuenta ni base de datos: favoritos y
 * recientes viven en el dispositivo (la TV de la sala, el teléfono).
 */
export function usePersistedSet(key: string) {
  const [ids, setIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      // localStorage no existe en el render de servidor, así que la
      // hidratación inicial solo puede ocurrir después del montaje.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setIds(new Set(JSON.parse(raw) as number[]));
    } catch {
      /* almacenamiento bloqueado (modo privado en webOS) */
    }
  }, [key]);

  const persist = useCallback(
    (next: Set<number>) => {
      setIds(next);
      try {
        window.localStorage.setItem(key, JSON.stringify([...next]));
      } catch {
        /* sin persistencia: la sesión sigue funcionando */
      }
    },
    [key],
  );

  const toggle = useCallback(
    (id: number) => {
      setIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          window.localStorage.setItem(key, JSON.stringify([...next]));
        } catch {}
        return next;
      });
    },
    [key],
  );

  const clear = useCallback(() => persist(new Set()), [persist]);

  return { ids, toggle, clear };
}

/** Lista ordenada por uso reciente (los últimos vistos primero). */
export function usePersistedRecents(key: string, limit = 12) {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setIds(JSON.parse(raw) as number[]);
    } catch {}
  }, [key]);

  const push = useCallback(
    (id: number) => {
      setIds((current) => {
        const next = [id, ...current.filter((value) => value !== id)].slice(0, limit);
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [key, limit],
  );

  return { ids, push };
}
