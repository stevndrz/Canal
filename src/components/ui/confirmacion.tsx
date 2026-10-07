"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { esTeclaAtras } from "@/hooks/use-spatial-nav";
import { Boton, type VarianteBoton } from "./boton";
import type { Tamano } from "./clases";

/**
 * Lo que no se puede deshacer, en dos pasos y sin ventana encima.
 *
 * El primer OK no borra: convierte el botón en «¿Borrar 12 favoritos? Sí / No»
 * en el mismo sitio, con el foco en **No**. Así un OK de más con el mando
 * —el gesto más fácil de repetir sin querer— nunca borra nada: hacen falta
 * dos pulsaciones distintas, y la segunda tiene que ir a propósito hacia «Sí».
 *
 * En línea y no en un diálogo: un `role="dialog"` apaga `use-spatial-nav`
 * entero y obliga a traer flechas y Atrás propios. Aquí la pregunta es parte
 * de la página, el mando sigue funcionando y Atrás (o Escape) cancela.
 */

interface ConfirmacionProps {
  /** El texto del botón en reposo: «Borrar todos». */
  children: ReactNode;
  /** La pregunta, con la cifra: «¿Borrar 12 favoritos?». */
  pregunta: ReactNode;
  onConfirmar: () => void;
  textoSi?: string;
  textoNo?: string;
  /** Cómo se ve el botón en reposo. «Sí» va siempre en peligro. */
  variante?: VarianteBoton;
  tamano?: Tamano;
  icono?: ReactNode;
  disabled?: boolean;
}

export function Confirmacion({
  children,
  pregunta,
  onConfirmar,
  textoSi = "Sí, borrar",
  textoNo = "No",
  variante = "secundario",
  tamano = "md",
  icono,
  disabled,
}: ConfirmacionProps) {
  const [preguntando, setPreguntando] = useState(false);
  const idPregunta = useId();
  const botonInicial = useRef<HTMLButtonElement>(null);
  const botonNo = useRef<HTMLButtonElement>(null);
  // Adónde va el foco tras el cambio de paso. Se decide al pulsar y se aplica
  // después de pintar: el botón de destino todavía no existe en el clic.
  const focoPendiente = useRef<"no" | "inicial" | null>(null);

  useEffect(() => {
    if (focoPendiente.current === "no") botonNo.current?.focus();
    if (focoPendiente.current === "inicial") botonInicial.current?.focus();
    focoPendiente.current = null;
  }, [preguntando]);

  const cerrar = () => {
    focoPendiente.current = "inicial";
    setPreguntando(false);
  };

  if (!preguntando) {
    return (
      <Boton
        ref={botonInicial}
        variante={variante}
        tamano={tamano}
        icono={icono}
        // `aria-disabled` y no `disabled`: tras «Sí» ya no queda nada que
        // borrar y el botón se apaga justo cuando el foco vuelve a él. Un
        // `disabled` nativo no acepta el foco, así que se perdía en <body> y
        // la siguiente flecha del mando saltaba a la barra de arriba, lejos
        // de donde estaba uno. Apagado así, sigue enfocable y se lee como
        // «no disponible».
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (disabled) return;
          focoPendiente.current = "no";
          setPreguntando(true);
        }}
      >
        {children}
      </Boton>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={idPregunta}
      className="ui-confirmacion"
      onBlur={(evento) => {
        // Si el mando (o Tab) se lleva el foco fuera, la pregunta se retira:
        // dejarla abierta a la espera dejaba un «Sí, borrar» suelto en la
        // lista al volver. Solo con un destino claro (`relatedTarget`):
        // Safari no enfoca los botones al tocarlos, y sin destino cerrar
        // aquí se comería el toque en «Sí».
        const destino = evento.relatedTarget as Node | null;
        if (destino && !evento.currentTarget.contains(destino)) setPreguntando(false);
      }}
      onKeyDown={(evento) => {
        // Atrás cancela la pregunta antes de que el hook de navegación la
        // use para salir de la vista: se para aquí mismo.
        if (esTeclaAtras(evento)) {
          evento.preventDefault();
          evento.stopPropagation();
          cerrar();
        }
      }}
    >
      <span id={idPregunta} className="ui-confirmacion-pregunta" aria-live="polite">
        {pregunta}
      </span>
      <span className="ui-confirmacion-botones">
        <Boton
          variante="peligro"
          tamano={tamano}
          onClick={() => {
            onConfirmar();
            cerrar();
          }}
        >
          {textoSi}
        </Boton>
        <Boton ref={botonNo} variante="secundario" tamano={tamano} onClick={cerrar}>
          {textoNo}
        </Boton>
      </span>
    </div>
  );
}
