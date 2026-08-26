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

/**
 * Cualquier cosa serializable, guardada en el dispositivo.
 *
 * Nace de un fallo, no de una idea: los Ajustes vivían en un `useState` a
 * secas, así que **cada recarga los devolvía a fábrica**. Alguien de la casa
 * ponía «controles grandes» y al cerrar la app se perdía. Lo mismo con el
 * ajuste de imagen y con el motor de vídeo.
 *
 * **Fusiona con el valor inicial al leer**, y eso no es un detalle: un objeto
 * guardado por una versión anterior no tiene las claves que se hayan añadido
 * después. Sin fusionar, `settings.ajusteImagen` llegaría `undefined` y el
 * reproductor recortaría la imagen sin que nadie lo haya pedido — un fallo
 * silencioso que solo aparecería en los aparatos que ya habían guardado algo.
 */
export function usePersistedJson<T extends object>(key: string, inicial: T) {
  const [valor, setValor] = useState<T>(inicial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const guardado = JSON.parse(raw) as Partial<T>;
      // Solo un objeto: si lo guardado es un número o una cadena —basura de
      // otra versión, u otra pestaña— se ignora en vez de reventar el render.
      if (!guardado || typeof guardado !== "object" || Array.isArray(guardado)) return;
      // localStorage no existe en el render de servidor: la hidratación real
      // solo puede ocurrir después del montaje.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValor({ ...inicial, ...guardado });
    } catch {
      /* almacenamiento bloqueado (modo privado en webOS) */
    }
    // `inicial` es una constante del módulo en todos los usos; meterla en las
    // dependencias solo invitaría a que alguien pase un objeto en línea y esto
    // se relea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /**
   * Admite un parche o una función, como `setState`.
   *
   * La función no es un adorno: la memoria de canales caídos es
   * lee-modifica-escribe (sumar un fallo al que ya había), y con solo un parche
   * habría que leer el valor de fuera, lo que en React significa trabajar con
   * una copia vieja en cuanto dos cosas se guardan seguidas.
   */
  const guardar = useCallback(
    (parche: Partial<T> | ((actual: T) => Partial<T>)) => {
      setValor((actual) => {
        const siguiente = { ...actual, ...(typeof parche === "function" ? parche(actual) : parche) };
        try {
          window.localStorage.setItem(key, JSON.stringify(siguiente));
        } catch {
          /* sin persistencia: la sesión sigue funcionando */
        }
        return siguiente;
      });
    },
    [key],
  );

  return [valor, guardar] as const;
}
