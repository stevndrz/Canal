"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type MemoriaProgreso,
  type Marca,
  marcar,
  olvidar,
  podar,
  posicionGuardada,
} from "@/lib/progreso";

const CLAVE = "canalcasa:progreso";

/**
 * `timeupdate` se dispara cuatro veces por segundo; guardar en cada uno serían
 * cuatro escrituras en `localStorage` por segundo durante toda una película.
 * Cinco segundos es lo peor que se pierde si alguien apaga de golpe.
 */
const CADA_MS = 5_000;

/** Lo guardado, o vacío. Nunca revienta: el almacenamiento puede estar cerrado. */
export function leerProgreso(): MemoriaProgreso {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return {};
    const guardado = JSON.parse(crudo) as unknown;
    if (!guardado || typeof guardado !== "object" || Array.isArray(guardado)) return {};
    return guardado as MemoriaProgreso;
  } catch {
    // Modo privado en webOS, cuota llena, JSON de otra versión: se empieza
    // vacío. Perder el progreso es molesto; no poder abrir la app, peor.
    return {};
  }
}

function escribirProgreso(memoria: MemoriaProgreso): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(memoria));
  } catch {
    /* ver `leerProgreso` */
  }
}

/**
 * Para quien reproduce. **No usa estado de React**: un `useState` aquí sería un
 * render cada cinco segundos durante toda la película, encima de un `<video>`
 * que ya gasta todo lo que el televisor tiene.
 *
 * `clave` vacía —los iframes no se pueden seguir— hace que esto no haga nada.
 */
export function useSeguirViendo(clave: string | undefined) {
  const ultimaEscrituraRef = useRef(0);

  /**
   * Función y no valor: leerlo al montar obligaría a tocar `localStorage`
   * durante el render y guardarlo en una `ref`, justo lo que React pide no
   * hacer. Dentro de `loadedmetadata` se lee cuando el `<video>` ya acepta un
   * `currentTime`, y ni un instante antes.
   */
  const posicionParaRetomar = useCallback((): number | undefined => {
    if (!clave || typeof window === "undefined") return undefined;
    return posicionGuardada(leerProgreso(), clave);
  }, [clave]);

  /**
   * `forzar` es para pausar, terminar y salir: esperar al siguiente turno del
   * reloj perdería justo la posición que se quería guardar.
   */
  const apuntar = useCallback(
    (posicion: number, duracion: number, forzar = false) => {
      if (!clave || !Number.isFinite(posicion) || !Number.isFinite(duracion)) return;

      const ahora = Date.now();
      if (!forzar && ahora - ultimaEscrituraRef.current < CADA_MS) return;
      ultimaEscrituraRef.current = ahora;

      const marca: Marca = { posicion, duracion, visto: ahora };
      const siguiente = marcar(leerProgreso(), clave, marca);
      escribirProgreso(siguiente);
    },
    [clave],
  );

  return { posicionParaRetomar, apuntar };
}

/**
 * Para quien lo enseña. Este sí lleva estado, y se lee al montar como el resto
 * de la persistencia del proyecto.
 *
 * No se entera de lo que el reproductor escribe mientras se ve algo, y está
 * bien: nadie mira la fila mientras ve una película, y al volver se remonta.
 */
export function useProgreso() {
  const [memoria, setMemoria] = useState<MemoriaProgreso>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemoria(podar(leerProgreso(), Date.now()));
  }, []);

  /** Quitar algo de la fila. Lo que se quita no vuelve. */
  const olvidarTitulo = useCallback((clave: string) => {
    setMemoria((actual) => {
      const siguiente = olvidar(actual, clave);
      if (siguiente === actual) return actual;
      escribirProgreso(siguiente);
      return siguiente;
    });
  }, []);

  return { memoria, olvidarTitulo };
}
