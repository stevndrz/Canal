"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Pause, Play, Users } from "lucide-react";
import { Boton } from "@/components/ui";
import { CuentaAtras } from "@/components/views/sala-cine";
import { useRelojSala } from "@/hooks/use-reloj-sala";
import { reloj as formatoReloj } from "@/lib/ver-juntos/historial";
import { leerPerfil, leerSalaRecordada, leerUltimaSala, type Perfil } from "@/lib/ver-juntos/recordar";
import { leerMinuto, type TituloDeSala } from "@/lib/ver-juntos/reloj";

/**
 * Sincronía suave, en la ficha: una franja bajo el reproductor de un servidor
 * que no se puede mandar (Vimeus y los demás iframes).
 *
 * Discreta a propósito: lo bueno de Ver juntos son «Nuestras películas», que
 * van sin anuncios y sincronizadas de verdad. Esto no se anuncia: solo aparece
 * si este aparato ya tiene una sala (se crea en Mi enlace), como un enlace de
 * texto, y no hace nada hasta que se pulsa.
 *
 * El guion: cada uno pasa sus anuncios y pulsa «Listo»; alguien pulsa
 * «Empezar», cuenta atrás, y todos dan play a la vez. Desde ahí la franja dice
 * por dónde deberían ir.
 */
export function SalaSuave({ titulo }: { titulo: TituloDeSala }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [codigo, setCodigo] = useState("");
  const [abierta, setAbierta] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [minuto, setMinuto] = useState("");
  useEffect(() => {
    // `localStorage` solo existe tras montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerfil(leerPerfil());
    const enCurso = leerSalaRecordada()?.codigo ?? "";
    setCodigo(enCurso || leerUltimaSala());
    // Si venía de la sala en esta misma pestaña, sigue dentro sin preguntar.
    setAbierta(Boolean(enCurso));
  }, []);

  const sala = useRelojSala({ perfil, codigo: abierta ? codigo : "", titulo });
  if (!perfil || !codigo) return null;

  if (!abierta) {
    return (
      <div className="sala-suave mt-3 flex justify-end">
        <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => setAbierta(true)}>
          <Users aria-hidden="true" className="mr-2 inline h-4 w-4" />
          Ver a la vez con la sala {codigo}
        </button>
      </div>
    );
  }

  const otros = sala.miembros.filter((m) => m.id !== sala.yo);
  const minutoLeido = leerMinuto(minuto);
  const estado =
    sala.estado === "conectando"
      ? "Entrando en la sala…"
      : sala.estado === "error"
        ? "No se pudo conectar con la sala."
        : otros.length === 0
          ? `Sala ${codigo} · esperando a la otra persona`
          : `Sala ${codigo} · ${otros.map((m) => `${m.nombre}${sala.listos.includes(m.id) ? " ✓" : ""}`).join(", ")}`;

  return (
    <section
      className="sala-suave mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radio-md)] border border-[var(--borde-sutil)] bg-relleno px-4 py-3 text-[length:var(--texto-sm)] text-tinta-2"
      aria-label="Ver a la vez"
    >
      <p className="m-0 min-w-0 flex-1 basis-56" role="status">
        {sala.empezado ? (
          <>
            <span className="text-tinta-1 font-semibold tabular-nums">
              {sala.corriendo ? "Deberían ir por " : "En pausa en "}
              {formatoReloj(sala.segundos)}
            </span>
            <span className="block">{estado}</span>
          </>
        ) : (
          <>
            <span className="text-tinta-1 font-semibold">{estado}</span>
            <span className="block">Pasen los anuncios, dejen la película en pausa al principio y pulsen «Listo».</span>
          </>
        )}
        {sala.otroTitulo && (
          <span className="block">
            {sala.otroTitulo.de} está en{" "}
            <Link href={sala.otroTitulo.ruta} className="text-tinta-1 underline">
              {sala.otroTitulo.nombre || "otro título"}
            </Link>
            .
          </span>
        )}
      </p>

      {sala.estado === "conectada" && (
        <div className="flex flex-wrap items-center gap-2">
          {!sala.empezado && (
            <Boton tamano="sm" variante={sala.yoListo ? "secundario" : "primario"} icono={<Check />} aria-pressed={sala.yoListo} onClick={() => sala.marcarListo(!sala.yoListo)}>
              {sala.yoListo ? "Estoy listo" : "Listo"}
            </Boton>
          )}
          {!sala.corriendo && (sala.empezado || sala.yoListo) && (
            <Boton tamano="sm" variante={sala.empezado || sala.todosListos ? "primario" : "secundario"} icono={<Play />} onClick={sala.empezar}>
              {sala.empezado ? "Seguir todos" : sala.todosListos ? "Empezar" : "Empezar sin esperar"}
            </Boton>
          )}
          {sala.corriendo && (
            <Boton tamano="sm" variante="primario" icono={<Pause />} onClick={sala.pausarTodos}>
              Pausa para todos
            </Boton>
          )}
          {sala.empezado && !corrigiendo && (
            <Boton tamano="sm" variante="fantasma" onClick={() => setCorrigiendo(true)}>
              Voy por…
            </Boton>
          )}
          {corrigiendo && (
            <form
              className="flex items-center gap-2"
              onSubmit={(evento) => {
                evento.preventDefault();
                if (minutoLeido === null) return;
                sala.voyPor(minutoLeido);
                setCorrigiendo(false);
                setMinuto("");
              }}
            >
              <input
                aria-label="Por dónde vas (minuto:segundo)"
                data-nav="input"
                className="w-24 rounded-[var(--radio-md)] border border-[var(--borde-fuerte)] bg-transparent px-3 py-2 text-tinta-1 tabular-nums"
                inputMode="numeric"
                placeholder="12:34"
                value={minuto}
                onChange={(evento) => setMinuto(evento.target.value)}
                autoFocus
              />
              <Boton tamano="sm" type="submit" disabled={minutoLeido === null}>
                Poner
              </Boton>
            </form>
          )}
          <Boton tamano="sm" variante="fantasma" onClick={() => setAbierta(false)}>
            Salir
          </Boton>
        </div>
      )}
      <CuentaAtras cuenta={sala.cuenta} />
    </section>
  );
}
