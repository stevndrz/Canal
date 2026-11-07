"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Check, Clapperboard, X } from "lucide-react";
import { esTeclaAtras } from "@/hooks/use-spatial-nav";
import type { Miembro } from "@/hooks/use-ver-juntos";
import type { Arte } from "@/lib/ver-juntos/portada";

/**
 * Las piezas de Mi enlace como «sala de cine para dos»: portada, presencia,
 * estante de pósters, hojas deslizantes y cuenta atrás. Solo presentación: el
 * estado vive en `fuente-view.tsx` y en `use-ver-juntos.ts`. Los estilos, en
 * la familia `.cine-*` de `globals.css`.
 */

/** «Tele sala» → «TS»; «Steven» → «ST». */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length >= 2) return (palabras[0]![0]! + palabras[1]![0]!).toUpperCase();
  return (palabras[0] ?? "?").slice(0, 2).toUpperCase();
}

export interface Persona {
  id: string;
  nombre: string;
  aqui: boolean;
  soyYo: boolean;
}

/**
 * Quién hay que pintar: este aparato primero; luego los que están
 * (encendidos) y, de los que alguna vez estuvieron, los que faltan (tenues).
 * Si nunca vino nadie más, un hueco «Esperando» para que se lea que es de dos.
 */
export function presencia(
  yo: { id: string; nombre: string },
  miembros: Miembro[],
  conocidos: Record<string, string>,
  dentro: boolean,
): Persona[] {
  const aqui = new Set(miembros.map((m) => m.id));
  const lista: Persona[] = [{ id: yo.id, nombre: yo.nombre, aqui: dentro && aqui.has(yo.id), soyYo: true }];
  for (const m of miembros) if (m.id !== yo.id) lista.push({ id: m.id, nombre: m.nombre, aqui: true, soyYo: false });
  for (const [id, nombre] of Object.entries(conocidos)) {
    if (!aqui.has(id) && id !== yo.id && lista.length < 3) lista.push({ id, nombre, aqui: false, soyYo: false });
  }
  if (lista.length === 1) lista.push({ id: "?", nombre: "Esperando", aqui: false, soyYo: false });
  return lista;
}

export function Presencia({ personas }: { personas: Persona[] }) {
  return (
    <ul className="cine-presencia" aria-label="Quién está en la sala">
      {personas.map((p) => (
        <li key={p.id} className={`cine-persona ${p.aqui ? "is-aqui" : ""}`}>
          <span className="cine-persona-circulo" aria-hidden="true">
            {p.id === "?" ? "?" : iniciales(p.nombre)}
          </span>
          <span className="cine-persona-nombre">
            {p.nombre}
            <span className="sr-only">{p.aqui ? ", aquí" : ", esperando"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** La portada: el arte de la película elegida de fondo y todo lo demás encima. */
export function Portada({
  fondo,
  sobretitulo,
  titulo,
  pildoras,
  children,
}: {
  fondo: string | null;
  sobretitulo: string;
  titulo: string;
  pildoras: string[];
  children: ReactNode;
}) {
  return (
    <section className={`cine-portada ${fondo ? "" : "is-sin-arte"}`} aria-labelledby="cine-titulo">
      {fondo && (
        // eslint-disable-next-line @next/next/no-img-element -- `<img>` llano: las teles viejas no entienden el `srcset` de next/image.
        <img className="cine-portada-fondo" src={fondo} alt="" aria-hidden="true" decoding="async" />
      )}
      <div className="cine-portada-velo" aria-hidden="true" />
      <div className="cine-portada-contenido">
        <p className="cine-sobretitulo">{sobretitulo}</p>
        <h2 id="cine-titulo" className="cine-titulo">
          {titulo}
        </h2>
        {pildoras.length > 0 && (
          <ul className="cine-pildoras" aria-label="Detalles">
            {pildoras.map((texto) => (
              <li key={texto} className="cine-pildora">
                {texto}
              </li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </section>
  );
}

export interface PeliculaEstante {
  url: string;
  titulo: string;
}

/** La fila de pósters 2:3; la elegida, con un aro blanco fino. */
export function Estante({
  peliculas,
  arte,
  elegida,
  alElegir,
  primeroRef,
}: {
  peliculas: PeliculaEstante[];
  arte: Record<string, Arte | null>;
  elegida: string | undefined;
  alElegir: (url: string) => void;
  primeroRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <section className="cine-estante" aria-labelledby="cine-estante-titulo">
      <h3 id="cine-estante-titulo" className="cine-estante-titulo">
        Nuestras películas
      </h3>
      <ul className="cine-estante-fila">
        {peliculas.map((pelicula, i) => {
          const poster = arte[pelicula.titulo]?.poster;
          const esLa = pelicula.url === elegida;
          return (
            <li key={pelicula.url}>
              <button
                ref={i === 0 ? primeroRef : undefined}
                type="button"
                data-nav="card"
                className={`cine-poster ${esLa ? "is-elegida" : ""}`}
                aria-pressed={esLa}
                onClick={() => alElegir(pelicula.url)}
              >
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ver `Portada`.
                  <img src={poster} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="cine-poster-vacio" aria-hidden="true">
                    <Clapperboard />
                  </span>
                )}
                <span className="cine-poster-titulo">{pelicula.titulo}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Hoja que sube desde abajo, para lo que no va en la vista principal (usar un
 * enlace, vincular este aparato). Atrás o Escape la cierran; al cerrar, el
 * foco vuelve a quien la abrió.
 */
export function Hoja({
  abierta,
  titulo,
  alCerrar,
  children,
}: {
  abierta: boolean;
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!abierta) return;
    const antes = document.activeElement as HTMLElement | null;
    // Al primer elemento que se pueda tocar, para que el mando no se quede fuera.
    const primero = panelRef.current?.querySelector<HTMLElement>("[data-nav], input, button");
    primero?.focus();
    const alTecla = (evento: KeyboardEvent) => {
      if (!esTeclaAtras(evento)) return;
      evento.preventDefault();
      evento.stopImmediatePropagation();
      alCerrar();
    };
    window.addEventListener("keydown", alTecla, true);
    return () => {
      window.removeEventListener("keydown", alTecla, true);
      antes?.focus?.();
    };
  }, [abierta, alCerrar]);

  if (!abierta) return null;
  return (
    <div className="cine-hoja-fondo" onClick={alCerrar}>
      <div
        ref={panelRef}
        className="cine-hoja"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="cine-hoja-cabeza">
          <h3 className="cine-hoja-titulo">{titulo}</h3>
          <button type="button" data-nav="button" className="cine-boton-redondo" aria-label="Cerrar" onClick={alCerrar}>
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** 3·2·1 a pantalla completa, en todos los aparatos a la vez. */
export function CuentaAtras({ cuenta }: { cuenta: number | null }) {
  if (cuenta === null) return null;
  return (
    <div className="cine-cuenta" role="status" aria-live="assertive">
      <span key={cuenta} className="cine-cuenta-numero">
        {cuenta}
      </span>
    </div>
  );
}

/** «Juntos · Steven ✓» arriba a la izquierda del reproductor, con un botón de salir. */
export function CabeceraJuntos({
  otro,
  acompanado,
  alSalir,
}: {
  otro: string | null;
  acompanado: boolean;
  alSalir: () => void;
}) {
  return (
    <div className="cine-cabecera">
      <button type="button" data-nav="button" className="cine-boton-redondo" aria-label="Volver a la sala" onClick={alSalir}>
        <X aria-hidden="true" />
      </button>
      <span className="cine-cabecera-pildora">
        Juntos{otro ? ` · ${otro}` : ""}
        {acompanado && <Check aria-label="está aquí" />}
      </span>
    </div>
  );
}
