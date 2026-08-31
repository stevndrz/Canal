"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Channel } from "@/lib/types";
import { channelMark } from "@/lib/channels";
import { hora } from "@/lib/guia-epg";
import {
  HORAS_VISIBLES,
  columnasDeFranja,
  estaEnEmision,
  filaDeParrilla,
  inicioDeFranja,
  posicionEnFranja,
  type BloqueParrilla,
} from "@/lib/parrilla";

/**
 * La guía en rejilla: canales en filas, el tiempo en horizontal.
 *
 * Estaba aplazada desde el rediseño —«Fuera el conmutador Lista/Guía y la
 * parrilla EPG: decidido dejarlo para una tanda posterior»— y es la vista que
 * más se parece a una televisión de verdad.
 *
 * **Tres cosas que gobiernan cómo está escrita, todas del televisor:**
 *
 * 1. **Solo se piden los canales que se ven.** La programación de varias horas
 *    no viaja con la lista (ver `/api/guia` para el porqué), así que esta
 *    pantalla pide una ventana de canales y nada más. Bajar pide la siguiente.
 * 2. **Las filas se pintan con `flex`, sin posicionamiento absoluto.**
 *    `filaDeParrilla` devuelve bloques que suman siempre el 100% del ancho,
 *    huecos incluidos, justamente para que esto sea posible: en un televisor
 *    viejo, decenas de elementos absolutos por fila cuestan mucho más.
 * 3. **Nada de `gap` en flex, en ningún sitio de este archivo.** En webOS y
 *    Tizen vale cero, así que las filas quedarían pegadas y los bloques sin
 *    separar. Se usan margen y borde, que sí funcionan en todas partes. Ver
 *    `soporte-gap.ts`, que documenta que esto afecta a setenta y siete sitios
 *    del proyecto y que no se había visto nunca porque no hay forma de probar
 *    en esos aparatos.
 *
 * Va con utilidades de Tailwind en línea y no con clases de `shell.css`: ese
 * archivo lo lleva el agente de diseño. Esto es lo justo para que la parrilla
 * se vea y se navegue bien; la pasada visual de verdad es suya.
 *
 * Y como el resto de la app: todo lo pulsable lleva `data-nav`, porque
 * `useSpatialNav` solo recoge eso y en un televisor no hay Tab.
 */

/** Cuántos canales se piden de una vez. Cuadra con `MAX_CANALES` de la ruta. */
const POR_TANDA = 40;

interface Respuesta {
  programas: [number, number, string][][];
  hayGuia: boolean;
}

export function ParrillaEpg({
  canales,
  sintonizado,
  onSelect,
  ahora,
}: {
  /** Los canales del filtro actual, ya ordenados por quien llama. */
  canales: Channel[];
  sintonizado: Channel | null;
  onSelect: (canal: Channel) => void;
  /**
   * El reloj entra por argumento, como en `guia-epg.ts`: así este componente
   * no llama a `Date.now()` durante el render y se puede razonar sobre él.
   */
  ahora: number;
}) {
  /**
   * Cuántos canales se están pidiendo, **atados a la lista para la que se
   * pidieron**.
   *
   * Guardar la lista junto al número es lo que hace que cambiar de categoría o
   * escribir en el buscador vuelva a empezar por arriba sin necesidad de un
   * efecto que lo reponga: si la lista que llega no es la misma que produjo
   * este número, el número no vale y se usa la primera tanda. Un efecto aquí
   * sería un render en cascada por cada pulsación del buscador.
   */
  const [tanda, setTanda] = useState<{ lista: Channel[]; cuantos: number }>({
    lista: canales,
    cuantos: POR_TANDA,
  });
  const cuantos = tanda.lista === canales ? tanda.cuantos : POR_TANDA;
  const [porCanal, setPorCanal] = useState<Map<string, [number, number, string][]>>(new Map());
  const [estado, setEstado] = useState<"cargando" | "listo" | "sin-guia" | "error">("cargando");

  /**
   * La franja se ancla a la media hora en punto y **no se recalcula con el
   * reloj**: si dependiera de `ahora`, la parrilla se redibujaría cada vez que
   * el reloj avanza y el foco del mando bailaría bajo los dedos de quien la
   * está recorriendo. Ver `inicioDeFranja`.
   */
  const desde = useMemo(() => inicioDeFranja(ahora), [ahora]);
  const hasta = desde + HORAS_VISIBLES * 60 * 60 * 1000;
  const columnas = useMemo(() => columnasDeFranja(desde), [desde]);

  const enPantalla = useMemo(() => canales.slice(0, cuantos), [canales, cuantos]);

  useEffect(() => {
    const nombres = enPantalla.map((canal) => canal.name);
    if (nombres.length === 0) return;

    const corte = new AbortController();
    (async () => {
      try {
        const parametros = new URLSearchParams({
          // Separados por salto de línea y no por coma: hay canales con coma
          // en el nombre y partirlos por ahí los rompería.
          canales: nombres.join("\n"),
          desde: String(desde),
          horas: String(HORAS_VISIBLES),
        });
        const respuesta = await fetch(`/api/guia?${parametros}`, { signal: corte.signal });
        if (!respuesta.ok) throw new Error(String(respuesta.status));
        const datos = (await respuesta.json()) as Respuesta;

        setPorCanal(new Map(nombres.map((nombre, i) => [nombre, datos.programas[i] ?? []])));
        setEstado(datos.hayGuia ? "listo" : "sin-guia");
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        setEstado("error");
      }
    })();

    return () => corte.abort();
  }, [enPantalla, desde]);

  const verMas = useCallback(
    () => setTanda({ lista: canales, cuantos: cuantos + POR_TANDA }),
    [canales, cuantos],
  );

  if (estado === "error") {
    return (
      <div className="livetv-list-empty">
        <p>No se pudo cargar la guía. La lista de canales sigue funcionando.</p>
      </div>
    );
  }

  return (
    <div className="parrilla flex flex-col">
      {estado === "sin-guia" && (
        <p className="mb-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-muted" role="status">
          Esta lista no trae guía de programación, así que la parrilla sale vacía. Se puede
          configurar una con <code>EPG_URL</code>.
        </p>
      )}

      {/* Cabecera de horas. Sticky para que al bajar por los canales se siga
          sabiendo qué hora se está mirando. */}
      <div className="sticky top-0 z-20 flex items-end border-b border-white/10 bg-black/80 pb-1 backdrop-blur">
        <span className="w-[8.5rem] shrink-0 sm:w-44" aria-hidden="true" />
        <div className="relative flex flex-1">
          {columnas.map((instante) => (
            <span
              key={instante}
              className="shrink-0 border-l border-white/10 pl-2 text-xs text-muted"
              style={{ width: `${100 / columnas.length}%` }}
            >
              {hora(instante)}
            </span>
          ))}

          {/* La línea del ahora: lo que de verdad convierte una tabla en una
              parrilla, porque dice de un vistazo por dónde va la emisión. */}
          {ahora >= desde && ahora < hasta && (
            <span
              className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-accent"
              style={{ left: `${posicionEnFranja(ahora, desde, hasta)}%` }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col">
        {enPantalla.map((canal) => (
          <FilaParrilla
            key={canal.id}
            canal={canal}
            programas={porCanal.get(canal.name) ?? []}
            desde={desde}
            hasta={hasta}
            ahora={ahora}
            activo={sintonizado?.id === canal.id}
            onSelect={onSelect}
          />
        ))}
      </div>

      {cuantos < canales.length && (
        <button type="button" data-nav="button" className="mt-3 self-center rounded-full border border-white/15 px-4 py-2 text-sm text-muted transition-colors hover:text-white" onClick={verMas}>
          Ver más canales ({(canales.length - cuantos).toLocaleString("es-GT")} restantes)
        </button>
      )}
    </div>
  );
}

function FilaParrilla({
  canal,
  programas,
  desde,
  hasta,
  ahora,
  activo,
  onSelect,
}: {
  canal: Channel;
  programas: [number, number, string][];
  desde: number;
  hasta: number;
  ahora: number;
  activo: boolean;
  onSelect: (canal: Channel) => void;
}) {
  const bloques = useMemo(
    () =>
      filaDeParrilla(
        programas.map(([inicio, fin, titulo]) => ({ inicio, fin, titulo })),
        desde,
        hasta,
      ),
    [programas, desde, hasta],
  );

  return (
    <div
      className={`mt-1 flex h-16 items-stretch rounded-lg ${
        activo ? "bg-accent/10 ring-1 ring-accent/40" : ""
      }`}
    >
      {/* El canal, fijo a la izquierda. Es un botón: desde la parrilla también
          se sintoniza, que es para lo que se mira una guía. */}
      <button
        type="button"
        data-nav="tile"
        className="flex w-[8.5rem] shrink-0 items-center overflow-hidden rounded-lg px-2 text-left sm:w-44"
        onClick={() => onSelect(canal)}
        title={canal.name}
      >
        {canal.logoUrl ? (
          // `<img>` y no `next/image`: los logos vienen de dominios arbitrarios
          // de la lista M3U. Es regla de `ARQUITECTURA.md`, y ya rompió
          // `/peliculas` una vez.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={canal.logoUrl} alt="" loading="lazy" className="mr-2 h-8 w-8 shrink-0 object-contain" />
        ) : (
          <b className="livetv-row-mark">{channelMark(canal)}</b>
        )}
        <span className="truncate text-sm font-semibold">{canal.name}</span>
      </button>

      <div className="flex flex-1 overflow-hidden">
        {bloques.map((bloque, i) => (
          <BloqueDePrograma
            key={`${bloque.inicio}-${i}`}
            bloque={bloque}
            enEmision={estaEnEmision(bloque, ahora)}
            onSelect={() => onSelect(canal)}
          />
        ))}
      </div>
    </div>
  );
}

function BloqueDePrograma({
  bloque,
  enEmision,
  onSelect,
}: {
  bloque: BloqueParrilla;
  enEmision: boolean;
  onSelect: () => void;
}) {
  // Un hueco no es pulsable ni lleva `data-nav`: sería una parada del mando
  // que no hace nada, y en un televisor cada parada de más se nota.
  if (bloque.hueco) {
    return (
      <span
        className="h-full shrink-0 border-l border-white/5"
        style={{ width: `${bloque.ancho}%` }}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      data-nav="tile"
      className={`flex h-full shrink-0 flex-col justify-center overflow-hidden border-l px-2 text-left transition-colors ${
        enEmision ? "border-accent bg-accent/15 text-white" : "border-white/10 text-muted hover:text-white"
      } ${bloque.cortadoAlInicio ? "border-l-0" : ""}`}
      style={{ width: `${bloque.ancho}%` }}
      onClick={onSelect}
      /* El título completo y la hora real en el tooltip: el bloque puede ser
         estrecho y quedarse con dos palabras, y la hora de inicio puede caer
         fuera de la franja que se está mirando. */
      title={`${bloque.titulo} · ${hora(bloque.inicio)}–${hora(bloque.fin)}`}
    >
      <span className="truncate text-sm">{bloque.titulo}</span>
      <span className="truncate text-xs text-muted">{hora(bloque.inicio)}</span>
    </button>
  );
}
