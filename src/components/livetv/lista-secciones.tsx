"use client";

import { ChevronLeft, ChevronRight, Globe2, MapPinOff, Flag, Star } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Channel } from "@/lib/types";
import { NOMBRE_DE_REGION, type Region } from "@/lib/origenes";
import { cifra, type Fila } from "@/lib/secciones-canales";
import { calcularVentana, ventanaCambio, type Ventana } from "@/lib/ventana-lista";
import { ChannelRow } from "./channel-row";
import { cajaConTitulo } from "@/hooks/use-spatial-nav";

/**
 * La lista de Canales por secciones, con ventana virtual.
 *
 * Cabeceras, filas de canal y botones («Ver los N», «Estados Unidos · 759»)
 * van en el mismo array (`Fila[]`, de `secciones-canales.ts`) y **miden lo
 * mismo**. Es lo que permite que la ventana siga siendo una división —la fila n
 * empieza en n × alto— sin un índice de alturas que mantener: el CSS da a
 * `.livetv-item` un alto fijo calculado con la escala tipográfica, así que
 * crece igual con «Muy grande» o en la tele, pero para todas a la vez.
 *
 * El alto no se apunta en una constante: se mide la distancia entre las dos
 * primeras filas montadas, hueco incluido. Antes había un `HUECO_FILA = 4`
 * que tenía que coincidir a mano con un `gap` de la hoja de estilos.
 */

const VENTANA_INICIAL: Ventana = { desde: 0, hasta: 40, huecoArriba: 0, huecoAbajo: 0 };

/** Pedir que se enfoque una fila, aunque ahora mismo no esté montada. */
export interface PeticionDeFoco {
  clave: string;
  /** Cambia en cada petición, para poder pedir dos veces la misma fila. */
  vez: number;
}

/**
 * La barra fija de arriba tapa lo que el scroll de `focus()` deja pegado al
 * borde. Se mide la barra que de verdad se ve (escritorio o teléfono) en vez
 * de repetir su alto aquí.
 */
function altoDeLaBarra(): number {
  let alto = 0;
  for (const barra of document.querySelectorAll<HTMLElement>("[data-nav-chrome]")) {
    const caja = barra.getBoundingClientRect();
    if (caja.height > 0 && caja.top <= 0) alto = Math.max(alto, caja.bottom);
  }
  return alto;
}

export function ListaSecciones({
  filas,
  favoritos,
  caidos,
  sonandoId,
  enfocar,
  onFocusCanal,
  onPlay,
  onToggleFavorite,
  onAbrir,
  onVolver,
}: {
  filas: Fila[];
  favoritos: Set<number>;
  caidos: Set<number>;
  sonandoId: number | null;
  enfocar: PeticionDeFoco | null;
  onFocusCanal: (canal: Channel) => void;
  onPlay: (canal: Channel) => void;
  onToggleFavorite: (canal: Channel) => void;
  onAbrir: (region: Region) => void;
  onVolver: () => void;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  /**
   * Ancla de lo que mide dónde empieza la lista: va siempre justo antes del
   * hueco de arriba y no depende de la ventana montada. Medir desde el propio
   * contenedor era circular —su `top` ya incluye el hueco de la ventana
   * anterior— y el error crecía con cada scroll hasta dejar la lista en blanco.
   */
  const ancla = useRef<HTMLDivElement | null>(null);
  const [ventana, setVentana] = useState<Ventana>(VENTANA_INICIAL);
  const altoFila = useRef(0);

  useEffect(() => {
    const nodo = contenedor.current;
    const cabeza = ancla.current;
    if (!nodo || !cabeza) return undefined;

    let pendiente = 0;
    const recalcular = () => {
      pendiente = 0;
      const primera = nodo.children[0] as HTMLElement | undefined;
      const segunda = nodo.children[1] as HTMLElement | undefined;
      if (primera) {
        altoFila.current = segunda
          ? segunda.getBoundingClientRect().top - primera.getBoundingClientRect().top
          : primera.getBoundingClientRect().height;
      }
      const siguiente = calcularVentana({
        desplazamiento: window.scrollY,
        alto: window.innerHeight,
        inicioLista: cabeza.getBoundingClientRect().bottom + window.scrollY,
        altoFila: altoFila.current,
        total: filas.length,
      });
      setVentana((actual) => (ventanaCambio(actual, siguiente) ? siguiente : actual));
    };

    const alDesplazar = () => {
      if (pendiente) return;
      pendiente = requestAnimationFrame(recalcular);
    };

    recalcular();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    window.addEventListener("resize", alDesplazar);
    return () => {
      if (pendiente) cancelAnimationFrame(pendiente);
      window.removeEventListener("scroll", alDesplazar);
      window.removeEventListener("resize", alDesplazar);
    };
  }, [filas.length]);

  /**
   * Llevar el foco a una fila que quizá no está montada: primero se desplaza
   * la ventana hasta su sitio (eso monta la fila) y en el render siguiente se
   * enfoca. Hace falta al abrir o cerrar «Ver los N»: el botón pulsado
   * desaparece, y un foco que cae en `<body>` deja el mando sin desde dónde
   * moverse.
   */
  const [objetivo, setObjetivo] = useState<PeticionDeFoco | null>(null);
  const [peticionVista, setPeticionVista] = useState<PeticionDeFoco | null>(null);
  if (enfocar !== peticionVista) {
    setPeticionVista(enfocar);
    setObjetivo(enfocar);
  }

  useLayoutEffect(() => {
    if (!objetivo) return;
    const indice = filas.findIndex((fila) => fila.clave === objetivo.clave);
    if (indice === -1) {
      // La fila pedida ya no existe (cambió el filtro): se olvida la petición
      // para no perseguirla en cada render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setObjetivo(null);
      return;
    }
    const fila = contenedor.current?.querySelector<HTMLElement>(
      `[data-fila="${CSS.escape(objetivo.clave)}"] [data-nav]`,
    );
    if (fila) {
      fila.focus({ preventScroll: true });
      const caja = cajaConTitulo(fila);
      const barra = altoDeLaBarra();
      if (caja.top < barra + 8 || caja.bottom > window.innerHeight - 8) {
        window.scrollBy({ top: caja.top - barra - 16 });
      }
      setObjetivo(null);
      return;
    }
    // No está montada: se lleva la ventana hasta ella y se vuelve a intentar
    // cuando el desplazamiento monte las filas de alrededor.
    const cabeza = ancla.current;
    if (cabeza && altoFila.current > 0) {
      const inicio = cabeza.getBoundingClientRect().bottom + window.scrollY;
      window.scrollTo({ top: inicio + indice * altoFila.current - altoDeLaBarra() - 16 });
    }
  }, [objetivo, filas, ventana]);

  const montadas = useMemo(
    () => filas.slice(ventana.desde, Math.min(ventana.hasta, filas.length)),
    [filas, ventana.desde, ventana.hasta],
  );

  return (
    <>
      <div ref={ancla} aria-hidden="true" />
      {ventana.huecoArriba > 0 && <div style={{ height: ventana.huecoArriba }} aria-hidden="true" />}
      <div className="livetv-rows" ref={contenedor}>
        {montadas.map((fila) => {
          switch (fila.tipo) {
            case "canal":
              return (
                <ChannelRow
                  key={fila.clave}
                  clave={fila.clave}
                  channel={fila.canal}
                  favorite={favoritos.has(fila.canal.id)}
                  caido={caidos.has(fila.canal.id)}
                  sonando={sonandoId === fila.canal.id}
                  sinPais={fila.sinPais}
                  onFocus={onFocusCanal}
                  onPlay={onPlay}
                  onToggleFavorite={onToggleFavorite}
                />
              );
            case "cabecera":
            case "subcabecera":
              return (
                <Cabecera
                  key={fila.clave}
                  clave={fila.clave}
                  titulo={fila.titulo}
                  detalle={fila.detalle}
                  sub={fila.tipo === "subcabecera"}
                />
              );
            case "aviso":
              return (
                <div key={fila.clave} className="livetv-item livetv-aviso" data-fila={fila.clave}>
                  {fila.clave === "aviso:mios" && <Star aria-hidden="true" className="livetv-aviso-icono" />}
                  <p>{fila.texto}</p>
                </div>
              );
            case "ver-todos":
              return (
                <div key={fila.clave} className="livetv-item livetv-ver-todos" data-fila={fila.clave}>
                  <button type="button" data-nav="button" onClick={() => onAbrir(fila.region)}>
                    Ver los {cifra(fila.total)} de {NOMBRE_DE_REGION[fila.region]}
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              );
            case "plegada":
              return (
                <Plegada key={fila.clave} clave={fila.clave} region={fila.region} total={fila.total} onAbrir={onAbrir} />
              );
            case "volver":
              return (
                <div key={fila.clave} className="livetv-item livetv-volver" data-fila={fila.clave}>
                  <button type="button" data-nav="button" onClick={onVolver}>
                    <ChevronLeft aria-hidden="true" />
                    Todas las secciones
                  </button>
                </div>
              );
          }
        })}
      </div>
      {ventana.huecoAbajo > 0 && <div style={{ height: ventana.huecoAbajo }} aria-hidden="true" />}
    </>
  );
}

const Cabecera = memo(function Cabecera({
  clave,
  titulo,
  detalle,
  sub,
}: {
  clave: string;
  titulo: string;
  detalle: string;
  sub: boolean;
}) {
  // Un `h3` de verdad (y `h4` para el país): quien navega por encabezados con
  // un lector de pantalla salta de sección en sección igual que con la vista.
  const Titulo = sub ? "h4" : "h3";
  return (
    <div className={`livetv-item livetv-seccion ${sub ? "is-sub" : ""}`} data-fila={clave}>
      <Titulo>{titulo}</Titulo>
      {detalle && <span>{detalle}</span>}
    </div>
  );
});

const ICONO_PLEGADA: Partial<Record<Region, typeof Globe2>> = {
  eeuu: Flag,
  mundo: Globe2,
  "sin-pais": MapPinOff,
};

function Plegada({
  clave,
  region,
  total,
  onAbrir,
}: {
  clave: string;
  region: Region;
  total: number;
  onAbrir: (region: Region) => void;
}) {
  const Icono = ICONO_PLEGADA[region] ?? Globe2;
  return (
    <div className="livetv-item livetv-plegada" data-fila={clave}>
      <button type="button" data-nav="button" onClick={() => onAbrir(region)}>
        <span className="livetv-plegada-icono" aria-hidden="true">
          <Icono />
        </span>
        <span className="livetv-plegada-nombre">{NOMBRE_DE_REGION[region]}</span>
        <span className="livetv-plegada-total">{cifra(total)}</span>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}
