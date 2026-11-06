"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Aviso, Boton, Campo, EncabezadoSeccion } from "@/components/ui";
import type { EstadoSala } from "@/hooks/use-ver-juntos";
import { LARGO_CODIGO, normalizarCodigo } from "@/lib/ver-juntos/sala";

/**
 * El panel de «Ver juntos» en Mi enlace: crear una sala, entrar con un código,
 * y saber en qué está.
 *
 * Va **encima** del reproductor a propósito: hay que entrar antes de darle a
 * reproducir. Con las primitivas de `components/ui` y la rejilla de
 * `.fuente-alta`, para no tocar las hojas de estilo.
 */
export function SalaJuntos({
  codigo,
  anfitrion,
  estado,
  acompanado,
  necesitaToque,
  esperandoVideo,
  alCrear,
  alEntrar,
  alSalir,
}: {
  codigo: string;
  anfitrion: boolean;
  estado: EstadoSala;
  acompanado: boolean;
  necesitaToque: boolean;
  /** Invitado dentro, sin vídeo del anfitrión todavía. */
  esperandoVideo: boolean;
  alCrear: () => void;
  alEntrar: (codigo: string) => void;
  alSalir: () => void;
}) {
  const [escrito, setEscrito] = useState("");
  const [error, setError] = useState("");

  if (estado === "sin-configurar") return null;

  if (!codigo) {
    return (
      <section className="fuente-sala" aria-labelledby="sala-titulo">
        <EncabezadoSeccion
          talla="seccion"
          nivel={3}
          idTitulo="sala-titulo"
          sobretitulo="Play, pausa y saltos, a la vez en los dos aparatos"
          titulo="Ver juntos"
        />
        <form
          className="fuente-alta"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            const limpio = normalizarCodigo(escrito);
            if (!limpio) {
              setError(`El código tiene ${LARGO_CODIGO} letras y números. Revísalo.`);
              return;
            }
            setError("");
            alEntrar(limpio);
          }}
        >
          <Campo
            tamano="lg"
            etiqueta="Código de la sala"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={LARGO_CODIGO + 2}
            value={escrito}
            onChange={(evento) => {
              setEscrito(evento.target.value);
              if (error) setError("");
            }}
            placeholder="Ej.: k7m2qx"
            invalido={Boolean(error)}
          />
          <Boton type="submit" variante="secundario" tamano="lg">
            Entrar
          </Boton>
          <Boton type="button" variante="primario" tamano="lg" icono={<Users />} onClick={alCrear}>
            Crear sala
          </Boton>
        </form>
        {error && (
          <Aviso tono="peligro" className="fuente-aviso">
            {error}
          </Aviso>
        )}
      </section>
    );
  }

  const situacion =
    estado === "error"
      ? "No se pudo conectar con la sala."
      : estado === "conectando"
        ? "Conectando…"
        : acompanado
          ? "Ya están los dos."
          : anfitrion
            ? "Esperando a que entre la otra persona."
            : "Buscando a quien creó la sala…";

  return (
    <section className="fuente-sala" aria-labelledby="sala-titulo" aria-live="polite">
      <EncabezadoSeccion
        talla="seccion"
        nivel={3}
        idTitulo="sala-titulo"
        sobretitulo={anfitrion ? "Pásale este código a quien vaya a ver contigo" : "Estás en la sala"}
        titulo={`Sala ${codigo}`}
      />
      <Aviso
        tono={estado === "error" ? "peligro" : acompanado ? "exito" : "info"}
        className="fuente-aviso"
        titulo={situacion}
        accion={{ texto: "Salir de la sala", onClick: alSalir }}
      >
        {anfitrion
          ? "Lo que hagas en tu reproductor pasa también en el suyo, y al revés."
          : esperandoVideo
            ? "En cuanto quien creó la sala tenga un vídeo puesto, aparecerá aquí solo."
            : "Lo que haga cualquiera de los dos pasa en los dos."}
      </Aviso>
      {necesitaToque && (
        <Aviso tono="aviso" className="fuente-aviso" titulo="Pulsa reproducir para unirte">
          Este aparato no deja arrancar un vídeo sin que lo toques una vez.
        </Aviso>
      )}
    </section>
  );
}
