"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { channelMark } from "@/lib/channels";
import { hora, porcentajeDelPrograma } from "@/lib/guia-epg";
import {
  bloquesDeFila,
  filasDeGuia,
  franjaPara,
  horasDeGuia,
  indiceEn,
  inicioDeVentana,
  moverCursor,
  textoRestante,
} from "@/lib/guia-interactiva";
import { columnasDeFranja, inicioDeFranja, posicionEnFranja, type BloqueParrilla, type ProgramaCrudo } from "@/lib/parrilla";
import { accionDeTecla } from "@/lib/teclas-mando";
import type { Channel } from "@/lib/types";

/**
 * La guía de pantalla completa, como la de una caja de cable: canales en
 * filas, horas en columnas y, abajo, el detalle de lo elegido.
 *
 * **Recorrerla no cambia de canal.** ↑↓ mueven la fila, ←→ el horario y solo
 * OK (o un clic) sintoniza. La tira de antes zapeaba con cada flecha: para
 * ver qué daban en el 7 había que poner el 7.
 *
 * El foco es un estado (fila + instante), no el foco del navegador: en una tele
 * vieja, mover `focus()` por decenas de celdas y medirlas en cada pulsación
 * cuesta fotogramas, y la navegación espacial está apagada en el reproductor.
 * Quien la monta le pasa las teclas con `tecla()`.
 *
 * Solo se pintan las filas de la ventana y solo se pide la guía de esas (y
 * unas pocas alrededor), a `/api/guia`, como la parrilla de Canales.
 */

export interface GuiaInteractivaHandle {
  /** Atiende una tecla. `true` si era suya y no hay que hacer nada más con ella. */
  tecla: (evento: KeyboardEvent) => boolean;
}

type Tupla = [number, number, string];

/** Filas de más que se piden por encima y por debajo de la ventana. */
const MARGEN_FILAS = 6;
/** Espera tras la última pulsación antes de pedir: mantener ↓ no lanza una petición por fila. */
const ESPERA_PEDIDO_MS = 180;

function clave(nombre: string, desde: number) {
  return `${desde}|${nombre}`;
}

/** Lo que dice la lista del canal, por si `/api/guia` no trae nada de él. */
function programasDeLaLista(canal: Channel): ProgramaCrudo[] {
  if (!canal.currentProgram || !canal.currentStart || !canal.currentEnd) return [];
  const lista = [{ titulo: canal.currentProgram, inicio: canal.currentStart, fin: canal.currentEnd }];
  if (canal.nextProgram && canal.nextStart && canal.nextStart >= canal.currentEnd) {
    lista.push({ titulo: canal.nextProgram, inicio: canal.nextStart, fin: canal.nextStart + 30 * 60_000 });
  }
  return lista;
}

function useMedidas() {
  const [medidas, setMedidas] = useState(() =>
    typeof window === "undefined" ? { ancho: 1280, alto: 720 } : { ancho: window.innerWidth, alto: window.innerHeight },
  );
  useEffect(() => {
    const medir = () => setMedidas({ ancho: window.innerWidth, alto: window.innerHeight });
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return medidas;
}

function useReloj() {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

export const GuiaInteractiva = forwardRef<
  GuiaInteractivaHandle,
  {
    playlist: Channel[];
    /** El que suena: la guía abre sobre él. */
    channelId: number;
    onTune: (canal: Channel) => void;
    onCerrar: () => void;
    /** Cualquier movimiento dentro: quien la monta reinicia su reloj de cierre. */
    onActividad: () => void;
  }
>(function GuiaInteractiva({ playlist, channelId, onTune, onCerrar, onActividad }, ref) {
  const ahora = useReloj();
  const { ancho, alto } = useMedidas();
  const horas = horasDeGuia(ancho);
  const filas = filasDeGuia(ancho, alto);

  const [foco, setFoco] = useState(() => Math.max(0, playlist.findIndex((c) => c.id === channelId)));
  const [cursor, setCursor] = useState(ahora);
  const [desde, setDesde] = useState(() => inicioDeFranja(ahora));
  const [programas, setProgramas] = useState<Map<string, Tupla[]>>(() => new Map());

  const total = playlist.length;
  const fila = Math.min(foco, Math.max(0, total - 1));
  const inicio = inicioDeVentana(total, fila, filas);
  const visibles = useMemo(() => playlist.slice(inicio, inicio + filas), [playlist, inicio, filas]);

  /** El cursor no se queda en el pasado aunque pase el tiempo con la guía abierta. */
  const t = Math.max(cursor, ahora);
  // La franja sigue al cursor, también si el tiempo la empuja.
  const franja = franjaPara(Math.max(desde, inicioDeFranja(ahora)), t, horas);
  const hasta = franja + horas * 60 * 60_000;
  const columnas = useMemo(() => columnasDeFranja(franja, horas), [franja, horas]);

  const programasDe = useCallback(
    (canal: Channel): ProgramaCrudo[] | null => {
      const tuplas = programas.get(clave(canal.name, franja));
      if (!tuplas) return null;
      if (tuplas.length === 0) return programasDeLaLista(canal);
      return tuplas.map(([i, f, titulo]) => ({ inicio: i, fin: f, titulo }));
    },
    [programas, franja],
  );

  const bloquesDe = useCallback(
    (canal: Channel): BloqueParrilla[] => bloquesDeFila(programasDe(canal) ?? programasDeLaLista(canal), franja, horas),
    [programasDe, franja, horas],
  );

  /* ── Pedir la guía de lo que se ve ─────────────────────────────────── */
  const pendientes = useMemo(() => {
    const desdeFila = Math.max(0, inicio - MARGEN_FILAS);
    return playlist
      .slice(desdeFila, inicio + filas + MARGEN_FILAS)
      .map((c) => c.name)
      .filter((nombre) => !programas.has(clave(nombre, franja)))
      .slice(0, 40);
  }, [playlist, inicio, filas, programas, franja]);

  useEffect(() => {
    if (pendientes.length === 0) return;
    const corte = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const parametros = new URLSearchParams({
          canales: pendientes.join("\n"),
          desde: String(franja),
          horas: String(horas),
        });
        const respuesta = await fetch(`/api/guia?${parametros}`, { signal: corte.signal });
        if (!respuesta.ok) throw new Error(String(respuesta.status));
        const datos = (await respuesta.json()) as { programas: Tupla[][] };
        setProgramas((antes) => {
          const nuevo = new Map(antes);
          pendientes.forEach((nombre, i) => nuevo.set(clave(nombre, franja), datos.programas[i] ?? []));
          return nuevo;
        });
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        // Sin guía la rejilla sigue sirviendo para elegir canal: se marcan
        // como «sin datos» para no volver a pedirlas en bucle.
        setProgramas((antes) => {
          const nuevo = new Map(antes);
          for (const nombre of pendientes) nuevo.set(clave(nombre, franja), []);
          return nuevo;
        });
      }
    }, ESPERA_PEDIDO_MS);
    return () => {
      clearTimeout(espera);
      corte.abort();
    };
  }, [pendientes, franja, horas]);

  /* ── Moverse ──────────────────────────────────────────────────────── */
  const enfocado = visibles[fila - inicio];
  const bloquesEnfocados = useMemo(() => (enfocado ? bloquesDe(enfocado) : []), [enfocado, bloquesDe]);
  const elegido = bloquesEnfocados[indiceEn(bloquesEnfocados, t, franja)];

  // Sin `useCallback`: el React Compiler ya memoriza este componente.
  const moverFila = (delta: number) =>
    setFoco((f) => Math.max(0, Math.min(total - 1, Math.min(f, total - 1) + delta)));
  const moverHorario = (delta: 1 | -1) => {
    const nuevo = moverCursor(bloquesEnfocados, t, delta, franja, ahora);
    setCursor(nuevo);
    setDesde(franjaPara(franja, nuevo, horas));
  };
  const volverAhora = () => {
    const ya = Date.now();
    setCursor(ya);
    setDesde(inicioDeFranja(ya));
  };
  const sintonizar = (canal: Channel | undefined) => {
    if (!canal) return;
    onTune(canal);
    onCerrar();
  };

  useImperativeHandle(
    ref,
    () => ({
      tecla(evento) {
        const accion = accionDeTecla(evento);
        let suya = true;
        switch (evento.key) {
          case "ArrowUp":
            moverFila(-1);
            break;
          case "ArrowDown":
            moverFila(1);
            break;
          case "ArrowLeft":
            moverHorario(-1);
            break;
          case "ArrowRight":
            moverHorario(1);
            break;
          case "PageUp":
            moverFila(-filas);
            break;
          case "PageDown":
            moverFila(filas);
            break;
          case "Home":
            volverAhora();
            break;
          case "Enter":
            // Sin `onActividad`: avisar de actividad tras sintonizar volvía
            // a abrir la guía que se acaba de cerrar.
            evento.preventDefault();
            sintonizar(enfocado);
            return true;
          default:
            if (accion === "canal-arriba") moverFila(-filas);
            else if (accion === "canal-abajo") moverFila(filas);
            else suya = false;
        }
        if (suya) {
          evento.preventDefault();
          onActividad();
        }
        return suya;
      },
    }),
  );

  /** La rueda del ratón recorre canales, de fila en fila. */
  const ruedaAcumulada = useRef(0);
  const alGirarRueda = (evento: React.WheelEvent) => {
    ruedaAcumulada.current += evento.deltaY;
    if (Math.abs(ruedaAcumulada.current) < 40) return;
    moverFila(ruedaAcumulada.current > 0 ? 1 : -1);
    ruedaAcumulada.current = 0;
    onActividad();
  };

  /** En el teléfono: deslizar arriba/abajo recorre canales, a los lados el horario. */
  const toque = useRef<{ x: number; y: number } | null>(null);
  const alEmpezarToque = (evento: React.TouchEvent) => {
    const punto = evento.touches[0];
    toque.current = { x: punto.clientX, y: punto.clientY };
  };
  const alMoverToque = (evento: React.TouchEvent) => {
    const origen = toque.current;
    if (!origen) return;
    const punto = evento.touches[0];
    const dx = punto.clientX - origen.x;
    const dy = punto.clientY - origen.y;
    if (Math.abs(dy) >= 44 && Math.abs(dy) > Math.abs(dx)) {
      moverFila(dy < 0 ? 1 : -1);
      toque.current = { x: punto.clientX, y: punto.clientY };
      onActividad();
    } else if (Math.abs(dx) >= 64) {
      moverHorario(dx < 0 ? 1 : -1);
      toque.current = { x: punto.clientX, y: punto.clientY };
      onActividad();
    }
  };

  const enEmision = elegido && !elegido.hueco && elegido.inicio <= ahora && ahora < elegido.fin;
  const progreso = enEmision ? porcentajeDelPrograma(elegido.inicio, elegido.fin, ahora) : null;
  const dia = new Date(franja).toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "numeric" });

  return (
    <div
      className="guia-tv"
      role="dialog"
      aria-label="Guía de programación"
      onWheel={alGirarRueda}
      onTouchStart={alEmpezarToque}
      onTouchMove={alMoverToque}
      onTouchEnd={() => (toque.current = null)}
      onMouseMove={onActividad}
      // Los clics de dentro no llegan al vídeo: si no, pausarían la emisión.
      onClick={(evento) => evento.stopPropagation()}
      onDoubleClick={(evento) => evento.stopPropagation()}
    >
      <div className="guia-tv-cabecera">
        <h2>Guía</h2>
        <span className="guia-tv-dia">{dia}</span>
        <span className="guia-tv-reloj">{hora(ahora)}</span>
      </div>

      <div className="guia-tv-horas" aria-hidden="true">
        <span className="guia-tv-esquina" />
        <div className="guia-tv-columnas">
          {columnas.map((instante) => (
            <span key={instante} style={{ width: `${100 / columnas.length}%` }}>
              {hora(instante)}
            </span>
          ))}
          {ahora >= franja && ahora < hasta && (
            <i className="guia-tv-ahora" style={{ left: `${posicionEnFranja(ahora, franja, hasta)}%` }} />
          )}
        </div>
      </div>

      <div className="guia-tv-filas" role="grid" aria-rowcount={total}>
        {visibles.map((canal, i) => {
          const indice = inicio + i;
          const esFoco = indice === fila;
          const cargando = programasDe(canal) === null && programasDeLaLista(canal).length === 0;
          const bloques = esFoco ? bloquesEnfocados : bloquesDe(canal);
          return (
            <div
              key={canal.id}
              role="row"
              aria-rowindex={indice + 1}
              className={`guia-tv-fila ${esFoco ? "is-foco" : ""} ${canal.id === channelId ? "is-sonando" : ""}`}
            >
              <button
                type="button"
                tabIndex={-1}
                className="guia-tv-canal"
                // `onMouseMove` y no `onMouseEnter`: al moverse la ventana, las
                // filas pasan por debajo de un ratón quieto y le robaban el foco
                // a las flechas.
                onMouseMove={() => setFoco(indice)}
                onClick={() => sintonizar(canal)}
              >
                <em>{canal.number}</em>
                {canal.logoUrl ? (
                  // `<img>` plano: los logos vienen de cientos de dominios.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={canal.logoUrl} alt="" loading="lazy" />
                ) : (
                  <b>{channelMark(canal)}</b>
                )}
                <span>{canal.name}</span>
              </button>
              <div className="guia-tv-programas">
                {cargando ? (
                  <span className="guia-tv-cargando" style={{ width: "100%" }} />
                ) : (
                  bloques.map((bloque, j) => {
                    const esElegido = esFoco && bloque === elegido;
                    return (
                      <button
                        key={`${bloque.inicio}-${j}`}
                        type="button"
                        tabIndex={-1}
                        role="gridcell"
                        aria-selected={esElegido}
                        className={`guia-tv-programa ${bloque.hueco ? "is-hueco" : ""} ${esElegido ? "is-elegido" : ""} ${
                          !bloque.hueco && bloque.inicio <= ahora && ahora < bloque.fin ? "is-ahora" : ""
                        } ${bloque.cortadoAlInicio ? "is-cortado" : ""}`}
                        style={{ width: `${bloque.ancho}%` }}
                        onMouseMove={() => {
                          setFoco(indice);
                          setCursor(Math.max(ahora, Math.max(bloque.inicio, franja)));
                        }}
                        onClick={() => sintonizar(canal)}
                      >
                        {bloque.hueco ? (j === 0 ? "Sin programación" : "") : bloque.titulo}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="guia-tv-detalle" aria-live="polite">
        {enfocado && (
          <>
            <p className="guia-tv-detalle-titulo">
              {elegido && !elegido.hueco ? elegido.titulo : enfocado.name}
            </p>
            <p className="guia-tv-detalle-meta">
              <span>
                {enfocado.number} {enfocado.name}
              </span>
              {elegido && !elegido.hueco && (
                <>
                  <span>
                    {hora(elegido.inicio)} – {hora(elegido.fin)}
                  </span>
                  <span>{enEmision ? textoRestante(elegido.fin, ahora) : `Empieza a las ${hora(elegido.inicio)}`}</span>
                </>
              )}
              {(!elegido || elegido.hueco) && <span>Sin programación para esta hora</span>}
            </p>
            {progreso !== null && (
              <span className="guia-tv-barra" aria-hidden="true">
                <i style={{ width: `${progreso}%` }} />
              </span>
            )}
          </>
        )}
        <p className="guia-tv-pistas" aria-hidden="true">
          ↑↓ canales · ←→ horario · OK ver · Atrás cerrar
        </p>
      </div>
    </div>
  );
});
