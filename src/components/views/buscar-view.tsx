"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Search } from "lucide-react";
import type { Channel } from "@/lib/types";
import { TvKeyboard } from "@/components/tv-keyboard";
import { channelToCard, type CardItem } from "@/lib/media-item";
import { MediaCard } from "@/components/media/media-card";
import { useBuscarTitulos } from "@/hooks/use-buscar-titulos";
import { useDictado } from "@/hooks/use-dictado";

/**
 * Buscar, en los dos catálogos a la vez.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/search/SearchScreen.tsx
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b):
 *   - Se conserva el teclado en pantalla de CanalCasa, ausente en el origen.
 *     En un televisor sin teclado físico, un campo de texto a secas es un
 *     callejón sin salida: el mando solo mueve el foco.
 *   - Busca en **dos** orígenes y no en uno. Antes solo recorría la lista M3U,
 *     así que escribir el nombre de una película no daba nada aunque estuviera
 *     en el catálogo: media aplicación quedaba fuera del buscador.
 *   - Se puede dictar. «Guardianes de la galaxia» son cuarenta y tantas
 *     pulsaciones de mando en el teclado en pantalla, o una pulsación y una
 *     frase. El botón **solo aparece donde el navegador sabe hacerlo** (ver
 *     `lib/dictado.ts`): en buena parte de los televisores no sabe, y ahí queda
 *     el teclado de siempre sin que nadie se entere de que faltaba algo.
 *
 * Los dos orígenes se consultan de forma distinta a propósito. Los canales ya
 * están enteros en el cliente desde la primera carga, así que se filtran en
 * memoria y responden en la misma pulsación. Las películas viven en TMDB y
 * pasan por `/api/buscar`, con antirrebote: la credencial no sale al
 * navegador, así que el cliente no puede preguntarle a TMDB directamente.
 */
interface BuscarViewProps {
  results: Channel[];
  search: string;
  onSearchChange: (value: string) => void;
  onTune: (channel: Channel) => void;
}

export function BuscarView({ results, search, onSearchChange, onTune }: BuscarViewProps) {
  const router = useRouter();
  const { resultados: titulos, cargando } = useBuscarTitulos(search);

  /**
   * Dictar **sustituye** lo escrito en vez de añadirse al final.
   *
   * Es lo que se espera: quien dicta está empezando una búsqueda, no
   * continuando la anterior. Concatenar dejaría «batmanguardianes de la
   * galaxia» a quien probó dos cosas seguidas.
   */
  const { soportado: hayVoz, escuchando, error: errorVoz, escuchar } = useDictado(onSearchChange);

  const tarjetasCanal = results.map((channel) => channelToCard(channel));

  // Estables: ver la nota de `home-view.tsx`. Un manejador nuevo por render
  // anula el `memo` de `MediaCard` y repinta la rejilla entera.
  const abrirCanal = useCallback(
    (card: CardItem) => {
      const canal = results.find((channel) => `canal-${channel.id}` === card.key);
      if (canal) onTune(canal);
    },
    [results, onTune],
  );

  const abrirTitulo = useCallback(
    (card: CardItem) => router.push(`/peliculas/${card.key.split("-")[0]}/${card.key.split("-").slice(1).join("-")}`),
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
