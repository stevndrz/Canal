"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Clapperboard, X } from "lucide-react";
import { esTeclaAtras } from "@/hooks/use-spatial-nav";
import type { Miembro } from "@/hooks/use-ver-juntos";
import type { EstadoPersona } from "@/lib/ver-juntos/sala";
import { enlaceDeSala, trazoDeQr } from "@/lib/ver-juntos/invitar";
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
  /** Viendo, en la sala, fuera un momento, o el hueco de quien falta. */
  estado: EstadoPersona | "esperando";
}

const TEXTO_ESTADO: Record<Persona["estado"], string> = {
  viendo: "Viendo",
  activo: "En la sala",
  ausente: "Fuera un momento",
  esperando: "Falta por entrar",
};

/**
 * Quién hay que pintar: este aparato primero, luego los que están y, apagados,
 * los que estaban y se les cortó la conexión (lo normal es que vuelvan
 * enseguida). Si no hay nadie más, un hueco para que se lea que es de dos.
 */
export function presencia(
  yo: { id: string; nombre: string },
  miembros: Miembro[],
  dentro: boolean,
  ausentes: Miembro[] = [],
): Persona[] {
  const mio = miembros.find((m) => m.id === yo.id);
  const lista: Persona[] = [
    { id: yo.id, nombre: yo.nombre, aqui: dentro && Boolean(mio), soyYo: true, estado: mio?.estado ?? "activo" },
  ];
  for (const m of miembros) {
    if (m.id !== yo.id) lista.push({ id: m.id, nombre: m.nombre, aqui: m.estado !== "ausente", soyYo: false, estado: m.estado ?? "activo" });
  }
  for (const m of ausentes) {
    if (m.id !== yo.id && !lista.some((p) => p.id === m.id)) lista.push({ id: m.id, nombre: m.nombre, aqui: false, soyYo: false, estado: "ausente" });
  }
  if (lista.length === 1) lista.push({ id: "?", nombre: "Alguien más", aqui: false, soyYo: false, estado: "esperando" });
  return lista;
}

/**
 * Los círculos de la sala. El punto de cada uno dice cómo está: verde y
 * latiendo si está viendo, blanco si está en la sala en pausa, apagado si
 * salió de la app un momento.
 */
export function Presencia({ personas }: { personas: Persona[] }) {
  return (
    <ul className="cine-presencia" aria-label="Quién está en la sala">
      {personas.map((p) => (
        <li key={p.id} className={`cine-persona is-${p.estado} ${p.aqui ? "is-aqui" : ""}`}>
          <span className="cine-persona-circulo" aria-hidden="true">
            {p.id === "?" ? "+" : iniciales(p.nombre)}
            <span className="cine-persona-punto" />
          </span>
          <span className="cine-persona-texto">
            <span className="cine-persona-nombre">{p.soyYo ? `${p.nombre} (tú)` : p.nombre}</span>
            <span className="cine-persona-estado">{TEXTO_ESTADO[p.estado]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * La portada: el arte de la película de fondo, difuminado, y en primer plano
 * el reproductor (`teatro`) entre el título y las acciones. Una sola película
 * a la vez: lo que se va a ver es lo que manda en la pantalla.
 */
export function Portada({
  fondo,
  sobretitulo,
  titulo,
  pildoras,
  teatro,
  estante,
  vacia,
  inmersivo = false,
  children,
}: {
  fondo: string | null;
  sobretitulo: string;
  titulo: string;
  pildoras: string[];
  /** El reproductor, ya montado. Sin película, nada. */
  teatro?: ReactNode;
  /**
   * «Nuestras películas», lo primero de la pantalla: qué hay para ver se
   * tiene que leer sin bajar, antes que el reproductor y que cualquier enlace.
   */
  estante?: ReactNode;
  /**
   * Sin película que enseñar (no hay ninguna, o el catálogo aún carga): esto
   * ocupa el sitio del título y del reproductor, y la pantalla empieza arriba
   * en vez de dejar media pantalla vacía. Trae su propio `#cine-titulo`.
   */
  vacia?: ReactNode;
  /**
   * El reproductor está a pantalla completa (`.cine-teatro.is-inmersivo`).
   * La portada suelta entonces su capa propia (`isolation`): con ella, el
   * reproductor competía DENTRO de la portada y la barra (z 60) le ganaba.
   */
  inmersivo?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`cine-portada ${fondo ? "" : "is-sin-arte"} ${teatro ? "con-teatro" : ""} ${estante ? "con-estante" : ""} ${vacia ? "is-vacia" : ""} ${inmersivo ? "con-inmersivo" : ""}`}
      aria-labelledby="cine-titulo"
    >
      {fondo && (
        // `key` por imagen: al cambiar de película, la nueva entra fundiéndose
        // en vez de saltar de golpe.
        // eslint-disable-next-line @next/next/no-img-element -- `<img>` llano: las teles viejas no entienden el `srcset` de next/image.
        <img key={fondo} className="cine-portada-fondo" src={fondo} alt="" aria-hidden="true" decoding="async" />
      )}
      <div className="cine-portada-velo" aria-hidden="true" />
      <div className="cine-portada-contenido">
        {estante}
        {vacia}
        {!vacia && sobretitulo && <p className="cine-sobretitulo">{sobretitulo}</p>}
        {!vacia && (
          <h2 id="cine-titulo" className="cine-titulo">
            {titulo}
          </h2>
        )}
        {!vacia && pildoras.length > 0 && (
          <ul className="cine-pildoras" aria-label="Detalles">
            {pildoras.map((texto) => (
              <li key={texto} className="cine-pildora">
                {texto}
              </li>
            ))}
          </ul>
        )}
        {teatro}
        {children}
      </div>
    </section>
  );
}

/**
 * Halo de luz detrás del reproductor con los colores de la película.
 *
 * Un `<canvas>` diminuto (32×18) en el que se pinta el fotograma cuatro
 * veces por segundo y que el CSS agranda y difumina: cuesta casi nada. No se
 * leen los píxeles, solo se muestran, así que da igual de qué dominio venga
 * el vídeo. En pausa se queda con el último fotograma (o con el póster).
 * En la tele no se pinta: la tele va a pantalla completa y su GPU no está
 * para lujos; tampoco con «reducir movimiento».
 */
export function Halo({ video, poster }: { video: HTMLVideoElement | null; poster: string | null }) {
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const lienzo = lienzoRef.current;
    const ctx = lienzo?.getContext("2d");
    if (!lienzo || !ctx) return;
    if (document.documentElement.dataset.pantalla === "tv") return;

    if (poster) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!video || video.paused) ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      };
      img.src = poster;
    }
    if (!video) return;
    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let id = 0;
    const pintar = () => {
      if (video.readyState >= 2) {
        try {
          ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
        } catch {
          // Algún motor no deja pintar el vídeo (HLS nativo en iPhone): sin halo.
        }
      }
    };
    const arrancar = () => {
      window.clearInterval(id);
      pintar();
      if (!quieto) id = window.setInterval(pintar, 250);
    };
    const parar = () => {
      window.clearInterval(id);
      pintar();
    };
    video.addEventListener("play", arrancar);
    video.addEventListener("pause", parar);
    video.addEventListener("seeked", pintar);
    if (!video.paused) arrancar();
    return () => {
      window.clearInterval(id);
      video.removeEventListener("play", arrancar);
      video.removeEventListener("pause", parar);
      video.removeEventListener("seeked", pintar);
    };
  }, [video, poster]);

  return <canvas ref={lienzoRef} className="cine-halo" width={32} height={18} aria-hidden="true" />;
}

export interface PeliculaEstante {
  url: string;
  titulo: string;
  /** «1 h 47 min». */
  duracion?: string;
  /** Por dónde iba la sala con ella, de 0 a 1, y dicho en palabras («Iban por 47:10»). */
  progreso?: number;
  iban?: string;
  /** Recién subida y sin empezar. */
  nueva?: boolean;
}

/**
 * Sin películas: qué es esto en una frase y cómo llega una película hasta
 * aquí. Nada de «elijan una película» cuando no hay nada que elegir.
 */
export function SalaVacia({ pc }: { pc?: ReactNode }) {
  return (
    <div className="cine-vacio">
      <h2 id="cine-titulo" className="cine-titulo">
        Nuestras películas
      </h2>
      <p className="cine-vacio-frase">Todavía no hay ninguna. Las que subas desde tu PC aparecen aquí, en todos los aparatos, para verlas juntos.</p>
      <ol className="cine-pasos" aria-label="Cómo llega una película">
        <li>Deja la película en la carpeta del PC</li>
        <li>El PC la convierte y la sube solo</li>
        <li>Aparece aquí, lista para ver juntos</li>
      </ol>
      {pc}
    </div>
  );
}

/** Mientras llega el catálogo: la forma de lo que va a salir, en vez de una pantalla en negro y un salto. */
export function SalaCargando() {
  return (
    <div className="cine-vacio" aria-busy="true">
      <h2 id="cine-titulo" className="cine-estante-titulo">
        Nuestras películas
      </h2>
      <div className="cine-esqueleto-fila" aria-hidden="true">
        <span className="cine-esqueleto is-poster" />
        <span className="cine-esqueleto is-poster" />
        <span className="cine-esqueleto is-poster" />
      </div>
      <span className="cine-esqueleto is-titulo" aria-hidden="true" />
      <span className="cine-esqueleto is-teatro" aria-hidden="true" />
      <span className="sr-only" role="status">
        Cargando las películas…
      </span>
    </div>
  );
}

/** La fila de pósters 2:3; la elegida, con un aro blanco fino. */
export function Estante({
  peliculas,
  arte,
  elegida,
  alElegir,
  primeroRef,
  entrada,
  nota,
}: {
  peliculas: PeliculaEstante[];
  arte: Record<string, Arte | null>;
  elegida: string | undefined;
  alElegir: (url: string) => void;
  primeroRef?: React.Ref<HTMLButtonElement>;
  /** Con el mando, el foco entra a la pantalla por la película elegida. */
  entrada?: boolean;
  /** Junto al título: qué está haciendo el PC que las sube. */
  nota?: ReactNode;
}) {
  return (
    <section className="cine-estante" aria-labelledby="cine-estante-titulo">
      <div className="cine-estante-cabeza">
        <h3 id="cine-estante-titulo" className="cine-estante-titulo">
          Nuestras películas
        </h3>
        {nota}
      </div>
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
                data-nav-entrada={entrada && (elegida ? esLa : i === 0) ? "" : undefined}
                className={`cine-poster ${esLa ? "is-elegida" : ""}`}
                aria-pressed={esLa}
                aria-label={pelicula.titulo}
                title={[pelicula.titulo, pelicula.iban ?? pelicula.duracion].filter(Boolean).join(" · ")}
                onClick={() => alElegir(pelicula.url)}
              >
                <span className="cine-poster-marco">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ver `Portada`.
                    <img src={poster} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="cine-poster-vacio" aria-hidden="true">
                      <Clapperboard />
                    </span>
                  )}
                  {pelicula.nueva && <span className="cine-poster-nueva">Nueva</span>}
                  {pelicula.progreso !== undefined && (
                    <span className="cine-poster-barra" aria-hidden="true">
                      <i style={{ width: `${Math.round(pelicula.progreso * 100)}%` }} />
                    </span>
                  )}
                </span>
                <span className="cine-poster-titulo">{pelicula.titulo}</span>
                {(pelicula.iban || pelicula.duracion) && <span className="cine-poster-dato">{pelicula.iban ?? pelicula.duracion}</span>}
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
 * enlace, el alias, el código de la sala). Atrás o Escape la cierran; al cerrar, el
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

/**
 * El código QR de la sala: en la tele (y en el PC) no hay hoja de compartir,
 * pero el teléfono está en la mano. Se escanea y entra directo, sin dictar el
 * código ni teclearlo con el mando.
 *
 * La librería que lo calcula se carga solo aquí, cuando hay sala y falta
 * alguien. Se pinta en el propio aparato: el enlace no sale a ningún servicio.
 */
export function QrSala({ codigo }: { codigo: string }) {
  const [qr, setQr] = useState<{ codigo: string; lado: number; d: string } | null>(null);
  useEffect(() => {
    let vivo = true;
    import("qrcode-generator")
      .then(({ default: qrcode }) => {
        if (!vivo) return;
        const q = qrcode(0, "M");
        q.addData(enlaceDeSala(window.location.origin, codigo));
        q.make();
        setQr({ codigo, ...trazoDeQr((fila, columna) => q.isDark(fila, columna), q.getModuleCount()) });
      })
      .catch(() => {
        // Sin QR queda el código a la vista, como siempre.
      });
    return () => {
      vivo = false;
    };
  }, [codigo]);

  // El de otra sala no se enseña ni un instante.
  if (!qr || qr.codigo !== codigo) return null;
  return (
    <figure className="cine-qr">
      <svg viewBox={`0 0 ${qr.lado} ${qr.lado}`} role="img" aria-label={`Código QR para entrar en la sala ${codigo.split("").join(" ")}`} shapeRendering="crispEdges">
        <rect className="cine-qr-fondo" width={qr.lado} height={qr.lado} />
        <path className="cine-qr-tinta" d={qr.d} />
      </svg>
      <figcaption>Escanea con el teléfono para entrar</figcaption>
    </figure>
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
  /** Solo a pantalla completa: en modo teatro no hay de dónde salir. */
  alSalir?: () => void;
}) {
  return (
    <div className="cine-cabecera">
      {alSalir && (
        <button type="button" data-nav="button" className="cine-boton-redondo" aria-label="Volver a la sala" onClick={alSalir}>
          <X aria-hidden="true" />
        </button>
      )}
      <span className="cine-cabecera-pildora">
        Juntos{otro ? ` · ${otro}` : ""}
        {acompanado && <Check aria-label="está aquí" />}
      </span>
    </div>
  );
}
