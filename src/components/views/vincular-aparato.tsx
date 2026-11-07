"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Loader2 } from "lucide-react";
import { Aviso, Campo, Chip } from "@/components/ui";
import { digitoDeTecla } from "@/hooks/use-spatial-nav";
import type { Aparato } from "@/lib/ver-juntos/recordar";

const NOMBRES_SUGERIDOS = ["Tele sala", "Tele cuarto", "PC", "Teléfono"];
const CIFRAS = 4;

/**
 * Vincular este aparato a la sala, una sola vez: un nombre y el PIN.
 *
 * Pensado para la tele: el nombre se elige de unas sugerencias sin teclear, y
 * el PIN entra con los números del mando o con el teclado de la pantalla,
 * que se maneja con las flechas. Al llegar a la cuarta cifra se manda solo.
 */
export function VincularAparato({ alVincular }: { alVincular: (aparato: Aparato) => void }) {
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  /**
   * El PIN también en una ref: con el mando las cifras pueden llegar más
   * deprisa que un render, y cada pulsación leería el PIN de antes.
   */
  const pinRef = useRef("");
  const enviandoRef = useRef(false);

  const mandar = useCallback(
    async (completo: string) => {
      const limpio = nombre.trim();
      if (!limpio) {
        setError("Primero ponle un nombre a este aparato.");
        pinRef.current = "";
        setPin("");
        return;
      }
      setEnviando(true);
      enviandoRef.current = true;
      setError("");
      try {
        const respuesta = await fetch("/api/sala/vincular", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: completo, nombre: limpio }),
        });
        const datos = (await respuesta.json().catch(() => ({}))) as Partial<Aparato> & { error?: string };
        if (!respuesta.ok || !datos.llave || !datos.canal || !datos.id || !datos.nombre) {
          setError(datos.error ?? "No se pudo vincular. Inténtalo otra vez.");
          pinRef.current = "";
          setPin("");
          return;
        }
        alVincular({ llave: datos.llave, canal: datos.canal, id: datos.id, nombre: datos.nombre });
      } catch {
        setError("Sin conexión con el servidor. Inténtalo otra vez.");
        pinRef.current = "";
        setPin("");
      } finally {
        enviandoRef.current = false;
        setEnviando(false);
      }
    },
    [nombre, alVincular],
  );

  const pulsar = useCallback(
    (cifra: string) => {
      if (enviandoRef.current || pinRef.current.length >= CIFRAS) return;
      setError("");
      const nuevo = pinRef.current + cifra;
      pinRef.current = nuevo;
      setPin(nuevo);
      if (nuevo.length === CIFRAS) void mandar(nuevo);
    },
    [mandar],
  );
  const borrar = useCallback(() => {
    pinRef.current = pinRef.current.slice(0, -1);
    setPin(pinRef.current);
  }, []);

  /**
   * Los números del mando, esté donde esté el foco (salvo escribiendo el
   * nombre). En captura y cortando la propagación: si no, la app los tomaba
   * también por un número de canal (`useMarcado`) y se iba a la tele.
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
    "grid min-h-14 place-items-center rounded-[var(--radio-md)] border border-[var(--borde-sutil)] bg-relleno text-xl font-semibold text-tinta-1 hover:bg-[var(--relleno-hover)] focus:bg-[var(--foco)] focus:text-fondo disabled:opacity-40";

  return (
    <section className="cine-vincular" aria-label="Vincular a la sala">
      <p className="mb-4 text-[length:var(--texto-sm)] text-tinta-3">
        Una sola vez en cada aparato. Después, aquí solo saldrá «Entrar a la sala».
      </p>
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Campo
            tamano="lg"
            etiqueta="¿Cómo se llama este aparato?"
            type="text"
            autoComplete="off"
            maxLength={24}
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Ej.: Steven, Tele sala"
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Nombres sugeridos">
            {NOMBRES_SUGERIDOS.map((sugerido, i) => (
              <Chip
                key={sugerido}
                data-nav-entrada={i === 0 ? "" : undefined}
                activo={nombre === sugerido}
                onClick={() => setNombre(sugerido)}
              >
                {sugerido}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-[length:var(--texto-sm)] text-tinta-2">PIN de la sala (con los números del mando o aquí)</p>
          <div className="flex gap-3" aria-live="polite" aria-label={`${pin.length} de ${CIFRAS} cifras`}>
            {Array.from({ length: CIFRAS }, (_, i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full border border-[var(--borde-fuerte)] ${i < pin.length ? "bg-tinta-1" : ""}`}
              />
            ))}
          </div>
          <div className="grid w-full max-w-72 grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((cifra) => (
              <button key={cifra} type="button" data-nav="key" className={tecla} disabled={enviando} onClick={() => pulsar(cifra)}>
                {cifra}
              </button>
            ))}
            <span aria-hidden="true" />
            <button type="button" data-nav="key" className={tecla} disabled={enviando} onClick={() => pulsar("0")}>
              0
            </button>
            <button type="button" data-nav="key" className={tecla} disabled={enviando} onClick={borrar} aria-label="Borrar">
              {enviando ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <Delete className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {error && (
          <Aviso tono="peligro" className="fuente-aviso">
            {error}
          </Aviso>
        )}
      </div>
    </section>
  );
}
