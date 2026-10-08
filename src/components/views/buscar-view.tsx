"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Keyboard, Mic, MicOff, Search, X } from "lucide-react";
import type { Channel } from "@/lib/types";
import { TvKeyboard } from "@/components/tv-keyboard";
import { channelToCard, type CardItem } from "@/lib/media-item";
import { buscarCanales, textoSinResultados } from "@/lib/buscar-canales";
import { cifra } from "@/lib/secciones-canales";
import { esTelevisorUA } from "@/lib/dispositivo";
import { MediaCard } from "@/components/media/media-card";
import { useBuscarTitulos } from "@/hooks/use-buscar-titulos";
import { useDictado } from "@/hooks/use-dictado";
import {
  agregarBusqueda,
  guardarBusquedas,
  interpretarBusquedas,
  leerBusquedasCrudas,
  quitarBusqueda,
  suscribirBusquedas,
} from "@/lib/busquedas-recientes";

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

/** Qué se enseña de los resultados. Las pestañas del diseño de Figma. */
type TipoBusqueda = "todo" | "canales" | "movie" | "tv";

const TIPOS: { id: TipoBusqueda; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "canales", label: "Canales" },
  { id: "movie", label: "Películas" },
  { id: "tv", label: "Series" },
];

/**
 * «Explorar», con el campo vacío. Son enlaces a secciones y géneros, no
 * búsquedas: el buscador encuentra por nombre, así que «comedia para ver en
 * familia» —lo que traía el diseño— no encontraría nada. Esto sí lleva a algo.
 */
const EXPLORAR: { texto: string; href: string }[] = [
  { texto: "Películas en tendencia", href: "/peliculas" },
  { texto: "Series populares", href: "/series" },
  { texto: "Anime en emisión", href: "/anime" },
  { texto: "Comedias", href: "/peliculas?genero=35" },
  { texto: "Para toda la familia", href: "/peliculas?genero=10751" },
  { texto: "Dramas", href: "/series?genero=18" },
];

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
  const { resultados: todosLosTitulos, cargando } = useBuscarTitulos(search);
  const [tipo, setTipo] = useState<TipoBusqueda>("todo");
  /** El teclado en pantalla: abierto de entrada en la tele; en el resto, a petición. */
  const [tecladoPedido, setTecladoPedido] = useState(false);
  const conTeclado = esTele || tecladoPedido;

  const crudas = useSyncExternalStore(suscribirBusquedas, leerBusquedasCrudas, () => null);
  const recientes = useMemo(() => interpretarBusquedas(crudas), [crudas]);
  const recordar = useCallback(() => {
    const siguiente = agregarBusqueda(recientes, search);
    if (siguiente !== recientes) guardarBusquedas(siguiente);
  }, [recientes, search]);

  const titulos = useMemo(
    () =>
      tipo === "movie" || tipo === "tv"
        ? todosLosTitulos.filter((item) => item.key.startsWith(`${tipo}-`))
        : todosLosTitulos,
    [tipo, todosLosTitulos],
  );

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
      if (buscando) recordar();
      onTune(canal, lista, titulo);
    },
    [canalPorClave, onTune, lista, buscando, search, recordar],
  );

  // La clave de una tarjeta de catálogo es `tipo-id`; la ruta, las dos partes.
  const abrirTitulo = useCallback(
    (tarjeta: CardItem) => {
      const [tipoFicha, ...resto] = tarjeta.key.split("-");
      recordar();
      router.push(`/peliculas/${tipoFicha}/${resto.join("-")}`);
    },
    [router, recordar],
  );

  /** Enter o «Buscar»: los resultados ya están; se apunta y se suelta el campo
      para que el teclado del teléfono deje verlos. */
  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    recordar();
    campo.current?.blur();
  };

  const totalCanales = encontrados.length;
  const totalTitulos = titulos.length;
  const sinCanales = buscando && totalCanales === 0;
  const verCanales = tipo === "todo" || tipo === "canales";
  const verTitulos = tipo !== "canales";

  return (
    <div className="screen has-search-hero buscar-pagina">
      <section className="search-hero buscar-portada">
        <p className="buscar-antetitulo">Todo tu contenido en un lugar</p>
        <h1 className="buscar-titulo">¿Qué quieres ver?</h1>
        <p className="buscar-subtitulo">Busca canales, películas y series por su nombre.</p>

        <form className="buscar-form" role="search" onSubmit={enviar}>
          {/* Icono, campo y botones dentro de la MISMA pieza. Sueltos, cada
              navegador pintaba el campo con su aspecto nativo: en los que
              ignoran `color-scheme: dark` eso era un rectángulo BLANCO en una
              pantalla negra (el «cuadro blanco» de televisor y PC). */}
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
              placeholder={esTele ? "Escribe con el teclado de abajo" : "Buscar canal, película o serie…"}
              aria-label="Buscar canales, películas y series"
            />

            {buscando && (
              <button
                type="button"
                data-nav="button"
                className="buscar-icono-boton"
                onClick={() => {
                  onSearchChange("");
                  campo.current?.focus();
                }}
                aria-label="Borrar la búsqueda"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}

            {hayVoz && (
              <button
                type="button"
                data-nav="button"
                onClick={escuchar}
                className={`buscar-icono-boton ${escuchando ? "is-activo" : ""}`}
                aria-pressed={escuchando}
                aria-label={escuchando ? "Dejar de escuchar" : "Buscar hablando"}
                title={escuchando ? "Dejar de escuchar" : "Buscar hablando"}
              >
                {escuchando ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
              </button>
            )}

            <button type="submit" data-nav="button" className="buscar-enviar">
              Buscar
            </button>
          </label>
        </form>

        <div className="buscar-opciones">
          <div className="buscar-tipos" role="group" aria-label="Qué buscar">
            {TIPOS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                data-nav="button"
                aria-pressed={tipo === id}
                className={`buscar-tipo ${tipo === id ? "is-activo" : ""}`}
                onClick={() => setTipo(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* En la tele el teclado ya está abierto y no hay nada que pedir. */}
          {!esTele && (
            <button
              type="button"
              data-nav="button"
              className={`buscar-util ${tecladoPedido ? "is-activo" : ""}`}
              aria-expanded={tecladoPedido}
              onClick={() => setTecladoPedido((abierto) => !abierto)}
            >
              <Keyboard size={16} aria-hidden="true" />
              Teclado en pantalla
            </button>
          )}
        </div>

        {/* `role="status"` y no un aviso pasajero: en un televisor nadie ve un
            mensaje que se va solo a los tres segundos. */}
        {escuchando && (
          <p className="buscar-aviso" role="status">
            Escuchando… di el nombre de un canal, una película o una serie.
          </p>
        )}
        {!escuchando && errorVoz && (
          <p className="buscar-aviso" role="status">
            {errorVoz}
          </p>
        )}
      </section>

      {!buscando && (
        <section className="buscar-atajos" aria-label="Atajos">
          <div>
            <div className="buscar-atajos-cabecera">
              <h2>Búsquedas recientes</h2>
              {recientes.length > 0 && (
                <button type="button" data-nav="button" className="buscar-borrar" onClick={() => guardarBusquedas([])}>
                  Borrar todo
                </button>
              )}
            </div>
            {recientes.length > 0 ? (
              <ul className="buscar-fichas">
                {recientes.map((item) => (
                  <li key={item} className="buscar-ficha">
                    <button type="button" data-nav="button" onClick={() => onSearchChange(item)}>
                      {item}
                    </button>
                    <button
                      type="button"
                      data-nav="button"
                      className="buscar-ficha-quitar"
                      aria-label={`Quitar «${item}»`}
                      onClick={() => guardarBusquedas(quitarBusqueda(recientes, item))}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="buscar-atajos-vacio">Lo que busques aparecerá aquí.</p>
            )}
          </div>

          <div>
            <div className="buscar-atajos-cabecera">
              <h2>Explorar</h2>
            </div>
            <ul className="buscar-fichas">
              {EXPLORAR.map(({ texto, href }, i) => (
                <li key={href}>
                  <Link href={href} data-nav="button" className="buscar-ficha buscar-ficha-enlace">
                    <span className="buscar-ficha-numero">{String(i + 1).padStart(2, "0")}</span>
                    {texto}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Teclado a un lado y resultados al otro. Puestos uno debajo del otro,
          el teclado de televisor mide más de 500px de alto y empuja los
          resultados fuera de la pantalla: escribes a ciegas. */}
      <div className={`buscar-cuerpo ${conTeclado ? "con-teclado" : ""}`}>
        {conTeclado && (
          <div className="buscar-teclado">
            <TvKeyboard
              entrada={esTele}
              onKey={(char) => onSearchChange(search + char)}
              onBackspace={() => onSearchChange(search.slice(0, -1))}
              onClear={() => onSearchChange("")}
            />
          </div>
        )}

        <div className="buscar-resultados">
          {/* Los canales primero: son la prioridad del producto, y además
              los únicos que responden al instante. */}
          {verCanales && (
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
          )}

          {verTitulos && buscando && (totalTitulos > 0 || cargando) && (
            <section className="buscar-grupo">
              <p className="buscar-recuento">
                {tipo === "movie" ? "Películas" : tipo === "tv" ? "Series" : "Películas y series"}{" "}
                {cargando ? "· buscando…" : `· ${totalTitulos}`}
              </p>
              <div className="grid-results is-embedded">
                {titulos.map((item) => (
                  <MediaCard key={item.key} item={item} posterMode onOpen={abrirTitulo} />
                ))}
              </div>
            </section>
          )}

          {verTitulos && !verCanales && buscando && !cargando && totalTitulos === 0 && (
            <p className="buscar-vacio" role="status">
              Nada con «{search.trim()}» en {tipo === "movie" ? "películas" : "series"}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
