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
 * Cada cuánto se escribe mientras algo se reproduce.
 *
 * El evento `timeupdate` se dispara unas cuatro veces por segundo. Guardar en
 * cada uno serían cuatro escrituras en `localStorage` por segundo durante toda
 * una película, y en el navegador de un televisor eso se nota. Cinco segundos
 * es lo peor que se puede perder si alguien apaga de golpe, y nadie echa de
 * menos cinco segundos.
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
 * Lo que hace falta para retomar algo, para quien lo reproduce.
 *
 * **No usa estado de React a propósito.** Este hook lo consume el reproductor,
 * y guardar por dónde va no debe repintar nada: se lee cuando hace falta y se
 * escribe directo. Un `useState` aquí significaría un render
 * cada cinco segundos durante toda la película, encima de un `<video>` que ya
 * está gastando todo lo que el televisor tiene.
 *
 * `clave` puede venir vacía —los proveedores por iframe no se pueden seguir— y
 * entonces esto no hace nada, en vez de guardar posiciones de algo que jamás se
 * va a poder retomar.
 */
export function useSeguirViendo(clave: string | undefined) {
  const ultimaEscrituraRef = useRef(0);

  /**
   * Por dónde iba, preguntado en el momento en que hace falta.
   *
   * Es una función y no un valor a propósito. Leerlo al montar obligaría a
   * tocar `localStorage` durante el render —que además no existe en el
   * servidor— y a guardarlo en una `ref`, que es justo lo que React pide no
   * hacer. Preguntarlo dentro del `loadedmetadata`, que es un manejador de
   * evento, lo resuelve sin rodeos: se lee cuando el `<video>` ya puede
   * aceptar un `currentTime`, y ni un instante antes.
   */
  const posicionParaRetomar = useCallback((): number | undefined => {
    if (!clave || typeof window === "undefined") return undefined;
    return posicionGuardada(leerProgreso(), clave);
  }, [clave]);

  /**
   * Apunta por dónde va. Limitado en frecuencia salvo que se le insista.
   *
   * `forzar` es para los momentos que sí importan —pausar, terminar, salir de
   * la pantalla—, donde esperar al siguiente turno del reloj perdería
   * justamente la posición que se quería guardar.
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
 * Lo empezado, para quien lo enseña (la fila de «Seguir viendo», las tarjetas).
 *
 * Este sí lleva estado, porque aquí sí hay que repintar. Se lee al montar, como
 * el resto de la persistencia del proyecto: `localStorage` no existe en el
 * render de servidor y leerlo antes rompería la hidratación.
 *
 * No se entera de lo que el reproductor va escribiendo mientras se ve algo, y
 * está bien así: nadie mira la fila mientras ve una película, y al volver a la
 * portada este hook se monta de nuevo y lee lo último.
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
