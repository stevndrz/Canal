"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Search } from "lucide-react";
import type { Channel } from "@/lib/types";
import { TvKeyboard } from "@/components/tv-keyboard";
import { channelToCard, type CardItem } from "@/lib/media-item";
import { buscarCanales, textoSinResultados } from "@/lib/buscar-canales";
import { cifra } from "@/lib/secciones-canales";
import { esTelevisorUA } from "@/lib/dispositivo";
import { MediaCard } from "@/components/media/media-card";
import { useBuscarTitulos } from "@/hooks/use-buscar-titulos";
import { useDictado } from "@/hooks/use-dictado";

/**
 * Cuántas fichas de canal se pintan como mucho. «a» casa con miles, y cada
 * ficha es un destino más que el mando mide en cada flecha: en una tele, mil
 * fichas son un segundo por pulsación. Lo más relevante va primero, así que
 * con 48 se ve lo que se busca; si no, se afina escribiendo.
 */
const MAX_FICHAS = 48;

/** El User-Agent no cambia: no hay nada a lo que suscribirse. */
const sinSuscripcion = () => () => {};

/**
 * ¿Es una tele? Por el User-Agent, como el servidor (`esTelevisorUA`), y con
 * `false` en el servidor: el primer render es igual en los dos lados y no hay
 * fallo de hidratación.
 */
function useEsTele(): boolean {
  return useSyncExternalStore(
    sinSuscripcion,
    () => esTelevisorUA(navigator.userAgent),
    () => false,
  );
}

/**
 * Buscar canales y catálogo a la vez.
 *
 * Los dos orígenes se consultan de forma distinta a propósito: los canales ya
 * están enteros en el cliente desde la primera carga, así que se buscan en
 * memoria (`buscar-canales.ts`, por relevancia y con índice) y responden en la
 * misma pulsación; las películas viven en TMDB y pasan por `/api/buscar` con
 * antirrebote, porque la credencial no sale al navegador.
 *
 * Tres formas de escribir, y las tres hacen falta: el campo, el teclado en
 * pantalla —sin él, un mando delante de un campo de texto es un callejón sin
 * salida— y el dictado, que solo aparece donde el navegador sabe hacerlo.
 *
 * **En la tele se entra por el teclado, no por el campo.** El campo tenía
 * `autoFocus`, y como las flechas no salían de un `<input>`, el mando quedaba
 * atrapado en él sin llegar nunca al teclado. Ahora, con UA de tele, el campo
 * es de solo lectura (no despierta el teclado del sistema) y la entrada de la
 * vista (`data-nav-entrada`) es la tecla «A». En el PC y el teléfono, el campo,
 * como siempre.
 */
export function BuscarView({
  canales,
  sugeridos,
  tunedId,
  search,
  onSearchChange,
  onTune,
}: {
  /** Todos los canales, como los pinta el shell (los caídos al final). */
  canales: Channel[];
  /** Lo que se ofrece con el campo vacío. */
  sugeridos: Channel[];
  tunedId: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  /** Con los resultados: pasan a ser lo que se zapea a pantalla completa. */
  onTune: (channel: Channel, resultados: Channel[], titulo: string) => void;
}) {
  const router = useRouter();
  const esTele = useEsTele();
  const campo = useRef<HTMLInputElement | null>(null);
  const { resultados: titulos, cargando } = useBuscarTitulos(search);

  // Dictar **sustituye** lo escrito: quien dicta empieza una búsqueda, no
  // continúa la anterior. Concatenar dejaría «batmanguardianes de la galaxia».
  const { soportado: hayVoz, escuchando, error: errorVoz, escuchar } = useDictado(onSearchChange);

  /**
   * Lo que hacía `autoFocus`, fuera de la tele: abrir Buscar y escribir. Con
   * el teléfono o el ratón el foco del mando no entra en juego (`focusFirst`
   * no actúa), así que lo pone esta vista.
   */
  useEffect(() => {
    if (esTele) return;
    if (document.activeElement && document.activeElement !== document.body) {
      // Si se llegó con el mando desde la barra, `focusFirst` lo trae aquí
      // igualmente (`data-nav-entrada`); con el ratón, el clic en la pestaña
      // no debe quedarse sin campo donde escribir.
      if (!document.activeElement.closest("[data-nav-chrome]")) return;
    }
    campo.current?.focus({ preventScroll: true });
  }, [esTele]);

  const buscando = search.trim().length > 0;

  /** Por relevancia; el índice normalizado se calcula una vez por lista. */
  const encontrados = useMemo(
    () => (buscando ? buscarCanales(canales, search) : []),
    [buscando, canales, search],
  );
  const lista = buscando ? encontrados : sugeridos;
  const mostrados = useMemo(() => lista.slice(0, MAX_FICHAS), [lista]);

  /**
   * Tarjetas e índice por clave, en una pasada y memorizados.
   *
   * Sin memorizar, cada pulsación del buscador creaba tarjetas nuevas y el
   * `memo` de `MediaCard` no acertaba nunca: se repintaba la rejilla entera por
   * cada letra, que es justo cuando menos margen hay. Y el índice evita
   * recorrer los resultados otra vez al pulsar una.
   */
  const { tarjetasCanal, canalPorClave } = useMemo(() => {
    const tarjetasCanal = mostrados.map(channelToCard);
    const canalPorClave = new Map(tarjetasCanal.map((t, i) => [t.key, mostrados[i]]));
    return { tarjetasCanal, canalPorClave };
  }, [mostrados]);

  const abrirCanal = useCallback(
    (tarjeta: CardItem) => {
      const canal = canalPorClave.get(tarjeta.key);
      if (!canal) return;
      const titulo = buscando ? `«${search.trim()}»` : "Sugeridos";
      onTune(canal, lista, titulo);
    },
    [canalPorClave, onTune, lista, buscando, search],
  );

  // La clave de una tarjeta de catálogo es `tipo-id`; la ruta, las dos partes.
  const abrirTitulo = useCallback(
    (tarjeta: CardItem) => {
      const [tipo, ...resto] = tarjeta.key.split("-");
      router.push(`/peliculas/${tipo}/${resto.join("-")}`);
    },
    [router],
  );

  const totalCanales = encontrados.length;
  const totalTitulos = titulos.length;
  const sinCanales = buscando && totalCanales === 0;

  return (
    <div className="screen has-search-hero">
      <section className="search-hero">
        {/* Icono y campo dentro de la MISMA píldora, como en Canales y en el
            catálogo. Sueltos como hermanos del grid, el campo se quedaba sin
            una sola regla propia y cada navegador lo pintaba con su aspecto
            nativo: en cuanto `color-scheme: dark` no se soporta —los
            navegadores de televisor viejos, y los de escritorio que no lo
            aplican— eso es un rectángulo BLANCO de borde a borde, con su
            cursor de escritura y su aspa, encajado en una pantalla negra. Es
            el «cuadro blanco» que se veía en televisor y en PC. */}
        <label className="buscar-campo">
          <span className="search-icon-shell">
            <Search size={22} aria-hidden="true" />
          </span>
          <input
            ref={campo}
            type="search"
            data-nav="input"
            data-nav-entrada={esTele ? undefined : ""}
            readOnly={esTele}
            value={search}
            onChange={(evento) => onSearchChange(evento.target.value)}
            placeholder={esTele ? "Escribe con el teclado de abajo" : "Buscar canales, películas y series"}
            aria-label="Buscar canales, películas y series"
          />

          {/* Dentro de la píldora y no fuera: en un mando, un destino de foco
              suelto al lado del campo es una parada más que estorba al bajar a
              los resultados. */}
          {hayVoz && (
            <button
              type="button"
              data-nav="button"
              onClick={escuchar}
              /* Utilidades en línea y no una clase de `shell.css`: ese archivo
                 lo lleva el agente de diseño. Esto es lo justo para que el
                 botón se vea correcto y esté al alcance del mando; la pasada
                 de diseño de verdad es suya. */
              className={`grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full transition-colors ${
                escuchando ? "bg-acento text-acento-tinta" : "text-muted hover:text-tinta-1"
              }`}
              aria-pressed={escuchando}
              aria-label={escuchando ? "Dejar de escuchar" : "Buscar hablando"}
              title={escuchando ? "Dejar de escuchar" : "Buscar hablando"}
            >
              {escuchando ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
            </button>
          )}
        </label>

        {/* `role="status"` y no un aviso pasajero: en un televisor nadie ve un
            mensaje que se va solo a los tres segundos. */}
        {escuchando && (
          <p className="mt-2 text-sm text-muted" role="status">
            Escuchando… di el nombre de un canal, una película o una serie.
          </p>
        )}
        {!escuchando && errorVoz && (
          <p className="mt-2 text-sm text-muted" role="status">
            {errorVoz}
          </p>
        )}
      </section>

      {/* Teclado a un lado y resultados al otro. Puestos uno debajo del otro,
          el teclado de televisor mide más de 500px de alto y empuja los
          resultados fuera de la pantalla: escribes a ciegas. */}
      <div className="buscar-cuerpo">
        <div className="buscar-teclado">
          <TvKeyboard
            entrada={esTele}
            onKey={(char) => onSearchChange(search + char)}
            onBackspace={() => onSearchChange(search.slice(0, -1))}
            onClear={() => onSearchChange("")}
          />
        </div>

        <div className="buscar-resultados">
          {/* Los canales primero: son la prioridad del producto, y además
              los únicos que responden al instante. */}
          <section className="buscar-grupo">
            {sinCanales ? (
              <p className="buscar-vacio" role="status">
                {textoSinResultados(search)}
              </p>
            ) : (
              <>
                <p className="buscar-recuento" role="status">
                  {!buscando
                    ? "Canales sugeridos"
                    : totalCanales > MAX_FICHAS
                      ? `Canales · ${cifra(totalCanales)} · los ${MAX_FICHAS} más parecidos`
                      : `Canales · ${cifra(totalCanales)}`}
                </p>
                {/* Fichas de canal (el logo entero, apaisado) y no carteles
                    2:3: el logo recortado se leía «anal 3», «evisi». */}
                <div className="grid-results is-embedded">
                  {tarjetasCanal.map((item, i) => (
                    <MediaCard
                      key={item.key}
                      item={item}
                      onOpen={abrirCanal}
                      active={mostrados[i].id === tunedId}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          {buscando && (totalTitulos > 0 || cargando) && (
            <section className="buscar-grupo">
              <p className="buscar-recuento">
                Películas y series {cargando ? "· buscando…" : `· ${totalTitulos}`}
              </p>
              <div className="grid-results is-embedded">
                {titulos.map((item) => (
                  <MediaCard key={item.key} item={item} posterMode onOpen={abrirTitulo} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
