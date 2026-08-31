"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IDIOMA, hayDictado, limpiarDictado, mensajeDeError, motorDeDictado } from "@/lib/dictado";

/**
 * Dictar una búsqueda, cuando el navegador sabe.
 *
 * Envuelve `SpeechRecognition`, que es un API con dos nombres, sin tipos en
 * TypeScript y con la costumbre de no avisar cuando algo va mal. Las decisiones
 * —si se puede, qué motor, cómo limpiar lo dictado, qué decir cuando falla—
 * viven en `lib/dictado.ts` y están probadas aparte; aquí solo queda el cableado
 * con el navegador y el ciclo de vida.
 *
 * `soportado` empieza en `false` y solo se enciende tras montar: el render de
 * servidor no tiene `window`, y decidir en el primer render rompería la
 * hidratación. Es el mismo patrón que `use-cast.ts`.
 */

/** Lo mínimo del API, que TypeScript no trae. */
interface ReconocimientoLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  abort: () => void;
  onresult: ((evento: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((evento: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

export function useDictado(alDictar: (texto: string) => void) {
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState("");

  const reconocimientoRef = useRef<ReconocimientoLike | null>(null);
  /**
   * El callback en una ref: si entrara como dependencia, cada pulsación del
   * buscador —que cambia `search` y con él el manejador— reconstruiría el
   * reconocedor a mitad de una frase.
   */
  const alDictarRef = useRef(alDictar);
  useEffect(() => {
    alDictarRef.current = alDictar;
  }, [alDictar]);

  useEffect(() => {
    // El entorno solo se puede mirar tras montar: en el render de servidor no
    // hay `window` ni `navigator`, y decidirlo en el primer render rompería la
    // hidratación. Mismo patrón —y mismo motivo— que `use-persisted-set.ts`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSoportado(
      hayDictado({
        SpeechRecognition: (window as unknown as Record<string, unknown>).SpeechRecognition,
        webkitSpeechRecognition: (window as unknown as Record<string, unknown>)
          .webkitSpeechRecognition,
        mediaDevices: navigator.mediaDevices,
      }),
    );
  }, []);

  // Cortar al desmontar: sin esto el micrófono se queda abierto al salir de la
  // pantalla, con su indicador encendido y sin nadie escuchando el resultado.
  useEffect(() => {
    return () => {
      reconocimientoRef.current?.abort();
      reconocimientoRef.current = null;
    };
  }, []);

  const escuchar = useCallback(() => {
    if (reconocimientoRef.current) {
      // Segunda pulsación: se corta. El botón hace las dos cosas porque en un
      // mando no sobra ningún destino de foco.
      reconocimientoRef.current.abort();
      reconocimientoRef.current = null;
      setEscuchando(false);
      return;
    }

    const Motor = motorDeDictado({
      SpeechRecognition: (window as unknown as Record<string, unknown>).SpeechRecognition,
      webkitSpeechRecognition: (window as unknown as Record<string, unknown>)
        .webkitSpeechRecognition,
      mediaDevices: navigator.mediaDevices,
    }) as (new () => ReconocimientoLike) | null;
    if (!Motor) return;

    setError("");

    let reconocimiento: ReconocimientoLike;
    try {
      reconocimiento = new Motor();
    } catch {
      // Algunos navegadores de televisor exponen el constructor y revientan al
      // instanciarlo. Se apaga el botón en vez de dejarlo fallando en cada
      // pulsación.
      setSoportado(false);
      return;
    }

    reconocimiento.lang = IDIOMA;
    // Una frase y para. `continuous` dejaría el micrófono abierto esperando
    // más, que en una búsqueda no aporta y en una tele es un indicador
    // encendido sin motivo.
    reconocimiento.continuous = false;
    reconocimiento.interimResults = false;
    reconocimiento.maxAlternatives = 1;

    reconocimiento.onresult = (evento) => {
      const texto = evento.results?.[0]?.[0]?.transcript ?? "";
      const limpio = limpiarDictado(texto);
      if (limpio) alDictarRef.current(limpio);
    };

    reconocimiento.onerror = (evento) => {
      const mensaje = mensajeDeError(evento?.error ?? "");
      // Cadena vacía = cancelación: no merece aviso.
      if (mensaje) setError(mensaje);
    };

    reconocimiento.onend = () => {
      reconocimientoRef.current = null;
      setEscuchando(false);
    };

    reconocimientoRef.current = reconocimiento;
    setEscuchando(true);

    try {
      reconocimiento.start();
    } catch {
      reconocimientoRef.current = null;
      setEscuchando(false);
    }
  }, []);

  return { soportado, escuchando, error, escuchar };
}
