"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type EnCurso,
  type MemoriaEnCurso,
  anotar,
  enCursoOrdenado,
  olvidarEnCurso,
  podarEnCurso,
} from "@/lib/continuar";

const CLAVE = "canalcasa:continuar";

/** Lo guardado, o vacío. Nunca revienta: el almacenamiento puede estar cerrado. */
function leer(): MemoriaEnCurso {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return {};
    const guardado = JSON.parse(crudo) as unknown;
    if (!guardado || typeof guardado !== "object" || Array.isArray(guardado)) return {};
    return guardado as MemoriaEnCurso;
  } catch {
    // Modo privado en webOS, cuota llena, JSON de otra versión: se empieza
    // vacío. Mismo criterio que `use-progreso.ts`.
    return {};
  }
}

function escribir(memoria: MemoriaEnCurso): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(memoria));
  } catch {
    /* ver `leer` */
  }
}

/**
 * Para quien reproduce: apunta que se está viendo esto.
 *
 * **Sin estado de React.** La ficha llama a esto al abrirse y cada vez que se
 * elige otro episodio; un `useState` aquí repintaría la ficha entera —vídeo
 * incluido— por escribir en `localStorage`. Mismo criterio que
 * `useSeguirViendo`.
 */
export function useAnotarEnCurso() {
  return useCallback((entrada: Omit<EnCurso, "visto">) => {
    if (typeof window === "undefined") return;
    const actual = leer();
    const siguiente = anotar(actual, { ...entrada, visto: Date.now() });
    if (siguiente !== actual) escribir(siguiente);
  }, []);
}

/**
 * Para quien lo enseña: la fila de «Seguir viendo».
 *
 * Se lee al montar, como el resto de la persistencia del proyecto. No se
 * entera de lo que la ficha escribe mientras se ve algo, y está bien: al
 * volver a Inicio se remonta.
 */
export function useContinuar() {
  const [memoria, setMemoria] = useState<MemoriaEnCurso>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemoria(podarEnCurso(leer(), Date.now()));
  }, []);

  /** Quitar algo de la fila. Lo que se quita no vuelve. */
  const olvidar = useCallback((clave: string) => {
    setMemoria((actual) => {
      const siguiente = olvidarEnCurso(actual, clave);
      if (siguiente === actual) return actual;
      escribir(siguiente);
      return siguiente;
    });
  }, []);

  return { memoria, enCurso: enCursoOrdenado(memoria), olvidar };
}
