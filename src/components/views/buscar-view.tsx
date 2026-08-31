"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Search } from "lucide-react";
import type { Channel } from "@/lib/types";
import { TvKeyboard } from "@/components/tv-keyboard";
import { channelToCard, type CardItem } from "@/lib/media-item";
import { MediaCard } from "@/components/media/media-card";
import { useBuscarTitulos } from "@/hooks/use-buscar-titulos";
import { useDictado } from "@/hooks/use-dictado";

/**
 * Buscar canales y catálogo a la vez.
 *
 * Los dos orígenes se consultan de forma distinta a propósito: los canales ya
 * están enteros en el cliente desde la primera carga, así que se filtran en
 * memoria y responden en la misma pulsación; las películas viven en TMDB y
 * pasan por `/api/buscar` con antirrebote, porque la credencial no sale al
 * navegador y el cliente no puede preguntarle directamente.
 *
 * Tres formas de escribir, y las tres hacen falta: el campo, el teclado en
 * pantalla —sin él, un mando delante de un campo de texto es un callejón sin
 * salida— y el dictado, que solo aparece donde el navegador sabe hacerlo.
 */
export function BuscarView({
  results,
  search,
  onSearchChange,
  onTune,
}: {
  results: Channel[];
  search: string;
  onSearchChange: (value: string) => void;
  onTune: (channel: Channel) => void;
}) {
  const router = useRouter();
  const { resultados: titulos, cargando } = useBuscarTitulos(search);

  // Dictar **sustituye** lo escrito: quien dicta empieza una búsqueda, no
  // continúa la anterior. Concatenar dejaría «batmanguardianes de la galaxia».
  const { soportado: hayVoz, escuchando, error: errorVoz, escuchar } = useDictado(onSearchChange);

  /**
   * Tarjetas e índice por clave, en una pasada y memorizados.
   *
   * Sin memorizar, cada pulsación del buscador creaba tarjetas nuevas y el
   * `memo` de `MediaCard` no acertaba nunca: se repintaba la rejilla entera por
   * cada letra, que es justo cuando menos margen hay. Y el índice evita
   * recorrer los resultados otra vez al pulsar una.
   */
  const { tarjetasCanal, canalPorClave } = useMemo(() => {
    const tarjetasCanal = results.map(channelToCard);
    const canalPorClave = new Map(tarjetasCanal.map((t, i) => [t.key, results[i]]));
    return { tarjetasCanal, canalPorClave };
  }, [results]);

  const abrirCanal = useCallback(
    (tarjeta: CardItem) => {
      const canal = canalPorClave.get(tarjeta.key);
      if (canal) onTune(canal);
    },
    [canalPorClave, onTune],
  );

  // La clave de una tarjeta de catálogo es `tipo-id`; la ruta, las dos partes.
  const abrirTitulo = useCallback(
    (tarjeta: CardItem) => {
      const [tipo, ...resto] = tarjeta.key.split("-");
      router.push(`/peliculas/${tipo}/${resto.join("-")}`);
    },
    [router],
  );

  const buscando = search.trim().length > 0;
  const totalCanales = results.length;
  const totalTitulos = titulos.length;
  const sinNada = buscando && !cargando && totalCanales === 0 && totalTitulos === 0;

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
            type="search"
            data-nav="input"
            value={search}
            autoFocus
            onChange={(evento) => onSearchChange(evento.target.value)}
            placeholder="Buscar canales, películas y series"
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
              className={`shrink-0 rounded-full p-2 transition-colors ${
                escuchando ? "bg-accent text-black" : "text-muted hover:text-white"
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
            onKey={(char) => onSearchChange(search + char)}
            onBackspace={() => onSearchChange(search.slice(0, -1))}
            onClear={() => onSearchChange("")}
          />
        </div>

        <div className="buscar-resultados">
          {sinNada ? (
            <p className="buscar-vacio">
              Nada coincide con «{search}», ni en los canales ni en el catálogo.
            </p>
          ) : (
            <>
              {/* Los canales primero: son la prioridad del producto, y además
                  los únicos que responden al instante. */}
              {totalCanales > 0 && (
                <section className="buscar-grupo">
                  <p className="buscar-recuento">
                    {buscando ? `Canales · ${totalCanales}` : "Canales sugeridos"}
                  </p>
                  <div className="grid-results is-embedded">
                    {tarjetasCanal.map((item) => (
                      <MediaCard key={item.key} item={item} onOpen={abrirCanal} posterMode />
                    ))}
                  </div>
                </section>
              )}

              {(totalTitulos > 0 || cargando) && (
                <section className="buscar-grupo">
                  <p className="buscar-recuento">
                    Películas y series {cargando ? "· buscando…" : `· ${totalTitulos}`}
                  </p>
                  <div className="grid-results is-embedded">
                    {titulos.map((item) => (
                      <MediaCard
                        key={item.key}
                        item={item}
                        posterMode
                        onOpen={abrirTitulo}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
