"use client";

import { useCallback, useEffect, useState, useMemo } from "react";

/**
 * Set de ids en localStorage. Sin cuenta ni base de datos: favoritos,
 * recientes y «Mi lista» viven en el dispositivo (la TV de la sala, el
 * teléfono).
 *
 * `T` por defecto es `number` — los canales se identifican por su id
 * numérico— pero admite `string`: «Mi lista» (`use-watchlist.ts`) necesita
 * `"movie-tmdb-550"` y no un número a secas, porque una película y una serie
 * pueden compartir el mismo `tmdbId`.
 */
export function usePersistedSet<T extends string | number = number>(key: string) {
  const [ids, setIds] = useState<Set<T>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      // localStorage no existe en el render de servidor, así que la
      // hidratación inicial solo puede ocurrir después del montaje.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setIds(new Set(JSON.parse(raw) as T[]));
    } catch {
      /* almacenamiento bloqueado (modo privado en webOS) */
    }
  }, [key]);

  const persist = useCallback(
    (next: Set<T>) => {
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
    (id: T) => {
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

  /**
   * El objeto, memorizado. Devolver `{ ids, push }` a pelo creaba una identidad
   * nueva en cada render, y eso llegaba lejos: cambiaba `select` en
   * `dashboard.tsx`, con él el `onOpen` de las tarjetas, y el comparador de
   * `memo(MediaCard)` dejaba de acertar. Medido: 121 tarjetas repintadas por
   * sintonizar un canal.
   */
  return useMemo(() => ({ ids, push }), [ids, push]);
}

/**
 * Cualquier cosa serializable, guardada en el dispositivo. Nace de un fallo:
 * los Ajustes vivían en un `useState` a secas y **cada recarga los devolvía a
 * fábrica**.
 *
 * **Fusiona con el valor inicial al leer**, y no es un detalle: lo guardado por
 * una versión anterior no trae las claves añadidas después, así que
 * `settings.ajusteImagen` llegaría `undefined` y el reproductor recortaría la
 * imagen sin que nadie lo pida — y solo en los aparatos que ya guardaron algo.
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
        const cambios = typeof parche === "function" ? parche(actual) : parche;

        /**
         * Si el parche no cambia nada, se devuelve el MISMO objeto.
         *
         * Sin esto, `{ ...actual, ...cambios }` era siempre un objeto nuevo, así
         * que toda llamada repintaba la aplicación entera y escribía en disco
         * aunque el contenido fuera idéntico. Y aquí «la aplicación entera» no
         * es una forma de hablar: `Dashboard` recalcula `visible` e `idsCaidos`
         * sobre 7.822 canales, hasheando cada URL. Con `registrarExito` sobre un
         * canal sano —que devuelve el mismo mapa a propósito— eso ocurría por
         * nada.
         */
        const igual = Object.keys(cambios).every(
          (clave) => actual[clave as keyof T] === cambios[clave as keyof T],
        );
        if (igual) return actual;

        const siguiente = { ...actual, ...cambios };
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
