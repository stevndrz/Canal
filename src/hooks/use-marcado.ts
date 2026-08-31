"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Channel } from "@/lib/types";
import {
  ESPERA_MS,
  canalDeMarcado,
  decidir,
  indexarParaMarcado,
  siguienteMarcado,
} from "@/lib/marcado";

/**
 * Marcar un canal por su número con los dígitos del mando.
 *
 * Las decisiones están en `lib/marcado.ts` y probadas aparte; aquí solo queda
 * el reloj y el estado de lo que se está marcando.
 */
export function useMarcado(canales: Channel[], onCanal: (canal: Channel) => void) {
  const [marcado, setMarcado] = useState("");
  const [noExiste, setNoExiste] = useState(false);
  const temporizador = useRef<number | null>(null);

  // Se reconstruye solo cuando cambia la lista, no en cada tecla: con 7.822
  // canales son unas 31.000 entradas y hacerlo por pulsación se notaría.
  const indice = useMemo(() => indexarParaMarcado(canales), [canales]);

  const limpiar = useCallback(() => {
    if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    temporizador.current = null;
  }, []);

  const saltar = useCallback(
    (numero: string) => {
      limpiar();
      const canal = canalDeMarcado(indice, numero);
      setMarcado("");
      setNoExiste(!canal);
      if (canal) onCanal(canal);
    },
    [indice, limpiar, onCanal],
  );

  const pulsarDigito = useCallback(
    (digito: string) => {
      setNoExiste(false);
      const siguiente = siguienteMarcado(marcado, digito);
      if (siguiente === null) return;

      const decision = decidir(indice, siguiente);
      if (decision.tipo === "saltar") {
        saltar(siguiente);
        return;
      }

      setMarcado(siguiente);
      limpiar();

      if (decision.tipo === "no-existe") {
        // No hay nada que esperar: se dice ya y se borra el marcado, en vez de
        // dejar dos segundos de silencio con un número que no lleva a ninguna
        // parte.
        setMarcado("");
        setNoExiste(true);
        return;
      }

      temporizador.current = window.setTimeout(() => saltar(siguiente), ESPERA_MS);
    },
    [marcado, indice, limpiar, saltar],
  );

  // El indicador de «ese canal no existe» se va solo: es un aviso, no un estado.
  useEffect(() => {
    if (!noExiste) return undefined;
    const id = window.setTimeout(() => setNoExiste(false), ESPERA_MS);
    return () => window.clearTimeout(id);
  }, [noExiste]);

  useEffect(() => limpiar, [limpiar]);

  return { marcado, noExiste, pulsarDigito };
}
