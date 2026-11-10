"use client";

import { useEffect, useState } from "react";
import { publicConfig } from "@/lib/config";
import { CALLADO_MS, fraseDelPc, leerEstadoPc, rutaEstadoPc, type EstadoPc, type FrasePc } from "@/lib/ver-juntos/estado-pc";

/** Con el PC trabajando, el porcentaje se mueve: se mira a menudo. */
const TRABAJANDO_MS = 15_000;
/** En reposo solo cambia «hace 5 min». */
const REPOSO_MS = 60_000;

/**
 * Lo que está haciendo el PC que sube las películas, en una frase.
 *
 * Se lee del mismo bucket que el catálogo. Sin bucket configurado, o si el PC
 * todavía no ha escrito nunca su estado (404), no hay frase: la pantalla queda
 * como estaba. Con la pestaña oculta no se pregunta.
 */
export function useEstadoPc(): FrasePc | null {
  const base = publicConfig.peliculasUrl;
  const [lectura, setLectura] = useState<{ estado: EstadoPc | null; ahora: number }>({ estado: null, ahora: 0 });

  useEffect(() => {
    if (!base) return;
    let vivo = true;
    let reloj = 0;
    let controlador: AbortController | null = null;

    const mirar = async () => {
      window.clearTimeout(reloj);
      if (document.visibilityState === "hidden") return;
      controlador?.abort();
      controlador = new AbortController();
      let estado: EstadoPc | null = null;
      try {
        const respuesta = await fetch(rutaEstadoPc(base), { cache: "no-store", signal: controlador.signal });
        if (respuesta.ok) estado = leerEstadoPc(await respuesta.json());
      } catch {
        // Sin red o sin estado: no es un fallo que enseñar, simplemente no se sabe.
      }
      if (!vivo) return;
      const ahora = Date.now();
      setLectura({ estado, ahora });
      const trabajando = Boolean(estado?.haciendo) && ahora - estado!.actualizado < CALLADO_MS;
      reloj = window.setTimeout(mirar, trabajando ? TRABAJANDO_MS : REPOSO_MS);
    };

    const alVolver = () => {
      if (document.visibilityState === "visible") void mirar();
    };
    document.addEventListener("visibilitychange", alVolver);
    void mirar();
    return () => {
      vivo = false;
      window.clearTimeout(reloj);
      controlador?.abort();
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [base]);

  return fraseDelPc(lectura.estado, lectura.ahora);
}
