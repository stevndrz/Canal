"use client";

import { LogOut, Users } from "lucide-react";
import { Aviso, Boton } from "@/components/ui";
import type { EstadoSala, Miembro } from "@/hooks/use-ver-juntos";
import type { PeliculaDeSala } from "@/lib/ver-juntos/sala";

/** «Tele sala» → «TS»; «Steven» → «ST». */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length >= 2) return (palabras[0]![0]! + palabras[1]![0]!).toUpperCase();
  return (palabras[0] ?? "?").slice(0, 2).toUpperCase();
}

/**
 * Quién hay que pintar: los que están (encendidos) y, de los que alguna vez
 * estuvieron, los que faltan (tenues). Este aparato, siempre el primero.
 */
export function presencia(
  yo: { id: string; nombre: string },
  miembros: Miembro[],
  conocidos: Record<string, string>,
): { id: string; nombre: string; aqui: boolean; soyYo: boolean }[] {
  const aqui = new Set(miembros.map((m) => m.id));
  const lista = [{ id: yo.id, nombre: yo.nombre, aqui: aqui.has(yo.id), soyYo: true }];
  for (const m of miembros) if (m.id !== yo.id) lista.push({ id: m.id, nombre: m.nombre, aqui: true, soyYo: false });
  for (const [id, nombre] of Object.entries(conocidos)) {
    if (!aqui.has(id) && id !== yo.id && lista.length < 4) lista.push({ id, nombre, aqui: false, soyYo: false });
  }
  return lista;
}

/**
 * La sala en Mi enlace: quién está, qué película tiene puesta, y entrar,
 * empezar o salir. Sin códigos: este aparato ya está vinculado.
 */
export function SalaJuntos({
  yo,
  estado,
  miembros,
  conocidos,
  pelicula,
  alEntrar,
  alEmpezar,
  alSalir,
}: {
  yo: { id: string; nombre: string };
  estado: EstadoSala;
  miembros: Miembro[];
  conocidos: Record<string, string>;
  pelicula: PeliculaDeSala | null;
  alEntrar: () => void;
  alEmpezar: () => void;
  alSalir: () => void;
}) {
  if (estado === "sin-configurar") return null;
  const dentro = estado !== "fuera";
  const acompanado = miembros.length >= 2;
  const otros = presencia(yo, miembros, conocidos).filter((p) => !p.soyYo);
  const falta = otros.find((p) => !p.aqui)?.nombre;

  const situacion =
    estado === "error"
      ? "No se pudo conectar con la sala."
      : estado === "conectando"
        ? "Entrando…"
        : !dentro
          ? ""
          : !pelicula
            ? "Elijan una película de «Nuestras películas»."
            : acompanado
              ? "Ya están los dos."
              : `Esperando a ${falta ?? "la otra persona"}…`;

  return (
    <section className="fuente-sala" aria-labelledby="sala-titulo" aria-live="polite">
      <p className="text-[length:var(--texto-sm)] text-tinta-3">{pelicula ? "La película de la sala" : "Ver juntos"}</p>
      <h3 id="sala-titulo" className="mb-4 text-[length:var(--texto-2xl)] font-semibold text-tinta-1">
        {pelicula?.video.titulo || "Sala de la casa"}
      </h3>

      <ul className="mb-4 flex flex-wrap gap-4" aria-label="Quién está en la sala">
        {presencia(yo, miembros, conocidos).map((p) => (
          <li key={p.id} className={`flex items-center gap-2 ${p.aqui ? "" : "opacity-45"}`}>
            <span
              className={`grid h-10 w-10 place-items-center rounded-full border text-[length:var(--texto-sm)] font-semibold ${
                p.aqui ? "border-transparent bg-tinta-1 text-fondo" : "border-[var(--borde-fuerte)] text-tinta-2"
              }`}
              aria-hidden="true"
            >
              {iniciales(p.nombre)}
            </span>
            <span className="text-[length:var(--texto-sm)] text-tinta-2">
              {p.nombre}
              {p.soyYo ? " (este)" : ""}
              <span className="sr-only">{p.aqui ? ", aquí" : ", esperando"}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        {!dentro ? (
          <Boton variante="primario" tamano="lg" icono={<Users />} onClick={alEntrar} data-nav-entrada="">
            Entrar a la sala
          </Boton>
        ) : (
          <>
            {pelicula && acompanado && estado === "conectada" && (
              <Boton variante="primario" tamano="lg" onClick={alEmpezar} data-nav-entrada="">
                Empezar
              </Boton>
            )}
            <Boton variante="secundario" tamano="lg" icono={<LogOut />} onClick={alSalir}>
              Salir de la sala
            </Boton>
          </>
        )}
      </div>

      {situacion && (
        <Aviso tono={estado === "error" ? "peligro" : acompanado ? "exito" : "info"} className="fuente-aviso" titulo={situacion}>
          {estado === "error"
            ? "Revisa la conexión. Si cambiaron el PIN de la sala, este aparato se desvinculará solo."
            : "Play, pausa y saltos pasan a la vez en todos los aparatos de la sala."}
        </Aviso>
      )}
    </section>
  );
}

/** 3·2·1 a pantalla completa, en todos los aparatos a la vez. */
export function CuentaAtras({ cuenta }: { cuenta: number | null }) {
  if (cuenta === null) return null;
  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-0 z-[var(--capa-dialogo)] grid place-items-center bg-fondo/85 backdrop-blur-md"
    >
      <span key={cuenta} className="text-[min(40vw,18rem)] font-semibold leading-none text-tinta-1 tabular-nums">
        {cuenta}
      </span>
    </div>
  );
}
