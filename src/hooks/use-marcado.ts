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

  /**
   * OK con un número a medio marcar lo da por terminado, sin esperar los dos
   * segundos: es lo que hace el mando de cualquier tele. Sin esto, «103»
   * esperaba siempre, porque hay canales del 1030 al 1039 y el marcado no
   * puede saber que no se iba a seguir tecleando.
   *
   * Escucha en fase de CAPTURA, registrado una sola vez al montar: así va por
   * delante del de `fullscreen-player.tsx` (que se registra después y se
   * vuelve a registrar en cada cambio), que si no se quedaría el OK para
   * abrir la guía. Lee el marcado por referencia para no re-registrarse.
   */
  const pendiente = useRef({ marcado, saltar });
  useEffect(() => {
    pendiente.current = { marcado, saltar };
  }, [marcado, saltar]);
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key !== "Enter" || !pendiente.current.marcado) return;
      evento.preventDefault();
      evento.stopPropagation();
      pendiente.current.saltar(pendiente.current.marcado);
    };
    window.addEventListener("keydown", alPulsar, true);
    return () => window.removeEventListener("keydown", alPulsar, true);
  }, []);

  // El indicador de «ese canal no existe» se va solo: es un aviso, no un estado.
  useEffect(() => {
    if (!noExiste) return undefined;
    const id = window.setTimeout(() => setNoExiste(false), ESPERA_MS);
    return () => window.clearTimeout(id);
  }, [noExiste]);

  useEffect(() => limpiar, [limpiar]);

  /**
   * El canal que saldría si se dejara de teclear ahora, para enseñarlo junto
   * al número: «7 · Canal 7». Así se sabe ANTES de saltar si se marcó bien.
   */
  const previsto = marcado ? canalDeMarcado(indice, marcado) : null;

  return { marcado, noExiste, previsto, pulsarDigito };
}
