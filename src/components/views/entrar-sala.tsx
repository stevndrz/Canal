"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Delete } from "lucide-react";
import { Aviso, Boton, Campo, Chip } from "@/components/ui";
import { digitoDeTecla } from "@/hooks/use-spatial-nav";
import { LARGO_CODIGO, limpiarNombre } from "@/lib/ver-juntos/sala";
import { iniciales } from "./sala-cine";

const ALIAS_SUGERIDOS = ["Steven", "Tele sala", "Tele cuarto", "Teléfono"];

/**
 * Elegir el alias de este aparato: lo que verá el otro en su círculo y en
 * «Juntos · Steven ✓». Se elige una vez y se recuerda. Con sugerencias para
 * no tener que teclear en la tele.
 */
export function ElegirAlias({ inicial, alGuardar }: { inicial: string; alGuardar: (nombre: string) => void }) {
  const [nombre, setNombre] = useState(inicial);
  const limpio = limpiarNombre(nombre);
  return (
    <form
      className="cine-alias flex flex-col gap-4"
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        if (limpio) alGuardar(limpio);
      }}
    >
      <div className="cine-alias-vista flex justify-center" aria-hidden="true">
        <span className="cine-persona is-aqui">
          <span className="cine-persona-circulo">{limpio ? iniciales(limpio) : "?"}</span>
        </span>
      </div>
      <Campo
        tamano="lg"
        etiqueta="Tu alias"
        type="text"
        autoComplete="off"
        maxLength={24}
        value={nombre}
        onChange={(evento) => setNombre(evento.target.value)}
        placeholder="Ej.: Steven"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sugerencias">
        {ALIAS_SUGERIDOS.map((sugerido, i) => (
          <Chip
            key={sugerido}
            type="button"
            data-nav-entrada={i === 0 ? "" : undefined}
            activo={nombre === sugerido}
            onClick={() => setNombre(sugerido)}
          >
            {sugerido}
          </Chip>
        ))}
      </div>
      <Boton type="submit" variante="primario" tamano="lg" disabled={!limpio}>
        Listo
      </Boton>
    </form>
  );
}

/**
 * Escribir el código de la sala: con los números del mando o con el teclado
 * de la pantalla, que se maneja con las flechas. A la cuarta cifra entra solo.
 */
export function TecladoCodigo({ alCompletar, error }: { alCompletar: (codigo: string) => void; error?: string }) {
  const [codigo, setCodigo] = useState("");
  // También en una ref: con el mando las cifras pueden llegar más deprisa que
  // un render, y cada pulsación leería el código de antes.
  const codigoRef = useRef("");

  const pulsar = useCallback(
    (cifra: string) => {
      if (codigoRef.current.length >= LARGO_CODIGO) return;
      const nuevo = codigoRef.current + cifra;
      codigoRef.current = nuevo;
      setCodigo(nuevo);
      if (nuevo.length === LARGO_CODIGO) {
        alCompletar(nuevo);
        codigoRef.current = "";
        // Se ve completo un instante antes de vaciarse.
        window.setTimeout(() => setCodigo(""), 300);
      }
    },
    [alCompletar],
  );
  const borrar = useCallback(() => {
    codigoRef.current = codigoRef.current.slice(0, -1);
    setCodigo(codigoRef.current);
  }, []);

  /**
   * Los números del mando, esté donde esté el foco. En captura y cortando la
   * propagación: si no, la app los tomaba también por un número de canal
   * (`useMarcado`) y se iba a la tele.
   */
  useEffect(() => {
    const alTecla = (evento: KeyboardEvent) => {
      const objetivo = evento.target as HTMLElement | null;
      if (objetivo?.tagName === "INPUT" || objetivo?.tagName === "TEXTAREA") return;
      const cifra = digitoDeTecla(evento);
      if (cifra !== null) {
        evento.preventDefault();
        evento.stopImmediatePropagation();
        pulsar(cifra);
      } else if (evento.key === "Backspace") {
        evento.preventDefault();
        evento.stopImmediatePropagation();
        borrar();
      }
    };
    window.addEventListener("keydown", alTecla, true);
    return () => window.removeEventListener("keydown", alTecla, true);
  }, [pulsar, borrar]);

  const tecla =
    "grid min-h-14 place-items-center rounded-[var(--radio-md)] border border-[var(--borde-sutil)] bg-relleno text-xl font-semibold text-tinta-1 hover:bg-[var(--relleno-hover)] focus:bg-[var(--foco)] focus:text-fondo";

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-[length:var(--texto-sm)] text-tinta-2">El código que ve la otra persona en su pantalla</p>
      <div className="flex gap-3" aria-live="polite" aria-label={`${codigo.length} de ${LARGO_CODIGO} cifras`}>
        {Array.from({ length: LARGO_CODIGO }, (_, i) => (
          <span
            key={i}
            className="grid h-14 w-12 place-items-center rounded-[var(--radio-md)] border border-[var(--borde-fuerte)] text-2xl font-semibold text-tinta-1 tabular-nums"
          >
            {codigo[i] ?? ""}
          </span>
        ))}
      </div>
      <div className="grid w-full max-w-72 grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((cifra, i) => (
          <button
            key={cifra}
            type="button"
            data-nav="key"
            data-nav-entrada={i === 0 ? "" : undefined}
            className={tecla}
            onClick={() => pulsar(cifra)}
          >
            {cifra}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" data-nav="key" className={tecla} onClick={() => pulsar("0")}>
          0
        </button>
        <button type="button" data-nav="key" className={tecla} onClick={borrar} aria-label="Borrar">
          <Delete className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <Aviso tono="peligro" className="fuente-aviso">
          {error}
        </Aviso>
      )}
    </div>
  );
}
