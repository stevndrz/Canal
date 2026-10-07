"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Clock, Search, SearchX, WifiOff, X } from "lucide-react";
import { useBuscarTitulos } from "@/hooks/use-buscar-titulos";
import type { OrdenCatalogo } from "@/lib/catalog/discover";
import type { CardItem } from "@/lib/media-item";
import { MediaCard } from "@/components/media/media-card";
import { EstadoVacio } from "./estado-vacio";

const ORDENES: { id: OrdenCatalogo; label: string }[] = [
  { id: "populares", label: "Más populares" },
  { id: "top", label: "Mejor valoradas" },
  { id: "recientes", label: "Más recientes" },
];

/**
 * Cine y series de arriba abajo: héroe, cabecera (título, buscador, filtros y
 * orden) y debajo el catálogo o los resultados.
 *
 * Los resultados se actualizan mientras se escribe. La petición a TMDB sigue
 * sin salir del servidor —la credencial no llega al navegador—, así que se
 * consulta `/api/buscar`; el antirrebote y la cancelación viven en
 * `useBuscarTitulos`.
 *
 * **Al escribir, el catálogo se recoge.** Antes el héroe (70 % de la
 * pantalla), el título, el orden y las píldoras se quedaban donde estaban y
 * los resultados caían debajo de todo: medido, el primer cartel quedaba en
 * y=914 en un iPhone de 844 de alto (y además tapado por el teclado), en
 * y=969 en un PC de 900 y en y=1196 en una tele de 1080. Se buscaba a ciegas.
 * Ahora, mientras hay texto, solo quedan el campo y los resultados justo
 * debajo; al vaciarlo vuelve todo, y el scroll que había.
 *
 * Por eso el héroe llega aquí como `cabecera` en vez de pintarse en la
 * página: es este componente, que sabe si se está buscando, quien decide si
 * se ve.
 */
export function CatalogSearch({
  initialQuery = "",
  orden = "populares",
  cabecera,
  titulo,
  filtros,
  children,
}: {
  /** Consulta previa si la URL traía `?q=`: el campo arranca ya escrita. */
  initialQuery?: string;
  /** Criterio activo del selector de orden. */
  orden?: OrdenCatalogo;
  /** El héroe, a sangre. Se recoge mientras se busca. */
  cabecera?: ReactNode;
  /** El nombre de la sección. Se recoge mientras se busca. */
  titulo?: ReactNode;
  /** Las píldoras de tipo y género. Se recogen mientras se busca. */
  filtros?: ReactNode;
  /** El catálogo (filas o cuadrícula). Lo sustituyen los resultados. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(initialQuery);
  const { resultados, pendiente, buscable, estado } = useBuscarTitulos(valor);
  const campo = useRef<HTMLInputElement | null>(null);

  const limpia = valor.trim();
  const buscando = limpia.length > 0;

  /**
   * El scroll de antes de buscar, para devolverlo al terminar.
   *
   * Al recoger el héroe la página encoge de golpe; si se estaba a mitad del
   * catálogo, el campo quedaría arriba fuera de la vista. Se sube al empezar
   * a buscar y, al vaciar el campo, se vuelve a donde se estaba mirando.
   * Antes de pintar (`useLayoutEffect`) para que no se vea el salto.
   */
  const scrollAntes = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (buscando) {
      window.scrollTo(0, 0);
    } else if (scrollAntes.current !== null) {
      window.scrollTo(0, scrollAntes.current);
      scrollAntes.current = null;
    }
  }, [buscando]);

  const escribir = (siguiente: string) => {
    if (!buscando && siguiente.trim()) scrollAntes.current = window.scrollY;
    setValor(siguiente);
    // Borrado a mano hasta dejarlo vacío: igual que el aspa, hay que quitar
    // la `?q=` de la URL. Con ella puesta el servidor no manda ni filas ni
    // héroe (ver `conConsulta` en la página), y al vaciar el campo quedaba
    // la cabecera sola sobre una pantalla vacía.
    if (buscando && !siguiente.trim()) quitarConsultaDeLaUrl();
  };

  /** Quita `?q=` sin tocar el resto de filtros: vuelves justo donde estabas. */
  const quitarConsultaDeLaUrl = () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("q")) return;
    params.delete("q");
    const cadena = params.toString();
    router.replace(cadena ? `/peliculas?${cadena}` : "/peliculas", { scroll: false });
  };

  /**
   * Abrir una ficha desde los resultados. `useCallback` no es adorno: la
   * rejilla puede devolver cientos de tarjetas memoizadas y una función nueva
   * por render —una por pulsación de tecla— las re-renderizaría todas.
   */
  const abrirResultado = useCallback(
    (item: CardItem) => {
      const [mediaType, ...resto] = item.key.split("-");
      router.push(`/peliculas/${mediaType}/${resto.join("-")}`);
    },
    [router],
  );

  /** Borrar la búsqueda y volver al catálogo. También limpia la `?q=` de la
      URL —si venía de un enlace compartido, recargar no la resucita— sin
      tocar el resto de filtros: vuelves justo donde estabas. */
  const limpiar = () => {
    setValor("");
    campo.current?.focus();
    quitarConsultaDeLaUrl();
  };

  /**
   * Enter sin recargar la app.
   *
   * El `<form>` nativo sigue ahí para un navegador sin JavaScript (entonces
   * sí va a `/peliculas?q=…`), pero con JavaScript un envío completo recargaba
   * la aplicación entera: barra, reproductor y estado. Aquí solo se apunta la
   * consulta en la URL —para que Atrás y compartir funcionen— y se suelta el
   * campo, que en un teléfono o en el teclado de la tele es lo que cierra el
   * teclado en pantalla y deja ver los resultados.
   */
  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!limpia) return;
    const params = new URLSearchParams(window.location.search);
    params.set("q", limpia);
    params.delete("pagina");
    router.replace(`/peliculas?${params.toString()}`, { scroll: false });
    campo.current?.blur();
  };

  /**
   * Escape con texto borra la búsqueda y se queda aquí. Sin parar la
   * propagación, el Atrás general (`useSpatialNav`, que escucha en `window`)
   * también la oía y sacaba de la sección entera con el texto a medias. Con
   * el campo ya vacío, Escape vuelve a ser Atrás.
   *
   * Las flechas no se tocan aquí: salir del campo con ↑/↓ (y con ←/→ en los
   * bordes del texto) lo resuelve `useSpatialNav` para todos los campos de la
   * app, ver `saleDelCampo`.
   */
  const teclas = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Escape" && valor) {
      evento.preventDefault();
      evento.stopPropagation();
      limpiar();
    }
  };

  const cambiarOrden = (siguiente: OrdenCatalogo) => {
    if (siguiente === orden) return;
    const params = new URLSearchParams(window.location.search);
    if (siguiente === "populares") params.delete("orden");
    else params.set("orden", siguiente);
    params.delete("pagina");
    const cadena = params.toString();
    router.push(cadena ? `/peliculas?${cadena}` : "/peliculas");
  };

  return (
    <>
      {!buscando && cabecera}

      <div className={`screen tv-safe catalogo ${cabecera && !buscando ? "has-hero" : ""}`}>
        <div className="catalogo-cabecera">
          {!buscando && titulo}

          <div className="catalogo-controles">
            <form action="/peliculas" method="get" role="search" className="catalogo-buscador-form" onSubmit={enviar}>
              <label className="catalogo-buscador-campo">
                <span className="sr-only">Buscar películas y series</span>
                <Search aria-hidden="true" />
                <input
                  ref={campo}
                  type="search"
                  name="q"
                  data-nav="input"
                  value={valor}
                  onChange={(evento) => escribir(evento.target.value)}
                  onKeyDown={teclas}
                  placeholder="Buscar película o serie"
                  autoComplete="off"
                  enterKeyHint="search"
                />
                {/* Aspa: solo existe mientras hay texto. Un toque borra la
                    búsqueda y devuelve el catálogo. 44 px de objetivo aunque
                    el icono sea pequeño. */}
                {buscando && (
                  <button
                    type="button"
                    data-nav="button"
                    onClick={limpiar}
                    aria-label="Borrar búsqueda y volver al catálogo"
                    title="Borrar y volver al catálogo"
                    className="catalogo-buscador-borrar"
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </label>
            </form>

            {!buscando && filtros}

            {/* El orden no pinta nada sobre una búsqueda: TMDB devuelve los
                resultados por relevancia. Se recoge con lo demás. */}
            {!buscando && (
              <label className="catalogo-orden-campo">
                <span className="catalogo-orden-etiqueta">Ordenar</span>
                <select
                  data-nav="input"
                  value={orden}
                  onChange={(evento) => cambiarOrden(evento.target.value as OrdenCatalogo)}
                  aria-label="Ordenar catálogo"
                  className="catalogo-orden"
                >
                  {ORDENES.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {buscando ? (
          <div className="catalogo-resultados" aria-live="polite">
            <Resultados
              consulta={limpia}
              buscable={buscable}
              pendiente={pendiente}
              estado={estado}
              resultados={resultados}
              onOpen={abrirResultado}
            />
          </div>
        ) : (
          children
        )}
      </div>
    </>
  );
}

/**
 * Lo que va bajo el campo mientras se busca. Un estado cada vez y sin
 * parpadeo: el esqueleto cubre la espera (antirrebote y red), así que
 * «No encontramos…» solo aparece cuando TMDB ya contestó que no hay nada.
 */
function Resultados({
  consulta,
  buscable,
  pendiente,
  estado,
  resultados,
  onOpen,
}: {
  consulta: string;
  buscable: boolean;
  pendiente: boolean;
  estado: "ok" | "no-disponible" | "limitado";
  resultados: (CardItem & { key: string })[];
  onOpen: (item: CardItem) => void;
}) {
  // Con una letra no se pregunta a nadie: TMDB devuelve ruido. Es una ayuda,
  // no un «vacío», así que va sin icono ni panel.
  if (!buscable) return <p className="catalogo-ayuda">Escribe al menos dos letras</p>;

  if (pendiente) {
    // Las mismas piezas que el esqueleto del catálogo: la forma de lo que va
    // a llegar, no una frase sola en medio de la pantalla.
    return (
      <div className="grid-results" role="status" aria-label={`Buscando «${consulta}»`}>
        {Array.from({ length: 12 }, (_, indice) => (
          <div className="esqueleto-cartel" key={indice} />
        ))}
      </div>
    );
  }

  if (estado === "limitado") {
    return (
      <EstadoVacio
        Icono={Clock}
        titulo="Demasiadas búsquedas seguidas"
        detalle="Espera un momento y vuelve a intentarlo."
      />
    );
  }

  if (estado === "no-disponible") {
    return (
      <EstadoVacio
        Icono={WifiOff}
        titulo="La búsqueda de películas no está disponible ahora"
        detalle="Suele arreglarse sola en unos minutos. La tele en directo funciona como siempre."
        accion={{ href: "/?vista=canales", texto: "Ver la tele en directo" }}
      />
    );
  }

  if (resultados.length === 0) {
    return (
      <EstadoVacio
        Icono={SearchX}
        titulo={`No encontramos «${consulta}»`}
        detalle="Prueba con otra palabra o con el título en inglés."
      />
    );
  }

  return (
    <div className="catalogo-aparece">
      <h2 className="catalogo-resultados-titulo">
        {resultados.length === 1 ? "1 resultado" : `${resultados.length} resultados`}
      </h2>
      <div className="grid-results">
        {resultados.map((item) => (
          <MediaCard key={item.key} item={item} posterMode onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
