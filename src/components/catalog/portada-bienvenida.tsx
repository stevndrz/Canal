"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, Link2, RotateCw, Tv } from "lucide-react";
import { esTelevisorUA } from "@/lib/dispositivo";
import type { EstadoCatalogo } from "@/lib/catalog/estado";

/**
 * Lo que se ve en Cine y series cuando no hay catálogo que enseñar.
 *
 * Antes era un recuadro con «Tu catálogo está vacío» y la instrucción de
 * editar `src/data/catalog.json` o configurar `TMDB_API_KEY`, debajo de un
 * buscador, un «Ordenar por» y unas píldoras que no llevaban a ninguna parte.
 * Quien lo veía era la familia, no quien despliega: le hablaba en jerga, le
 * ofrecía controles muertos y no le daba ninguna salida.
 *
 * Ahora es una portada en su idioma, con lo que SÍ funciona a un toque: la
 * tele en directo, que no depende de TMDB, y «Mi enlace» o reintentar según
 * el caso. Los textos son los del informe de Cine y series (§3):
 *
 * - `sin-configurar` no se arregla reintentando, así que no se ofrece: se
 *   ofrece la otra forma de ver una película, que es Mi enlace.
 * - `no-disponible` suele arreglarse solo, así que sí se ofrece «Volver a
 *   intentar», y una sola vez por pulsación (`router.refresh()`).
 *
 * El aviso técnico, si lo hay, lo decide la página (solo en desarrollo) y
 * llega por `aviso`.
 */
export function PortadaBienvenida({
  estado,
  aviso,
}: {
  estado: Exclude<EstadoCatalogo, "listo">;
  /** Una banda técnica para quien desarrolla. En producción no llega. */
  aviso?: ReactNode;
}) {
  const router = useRouter();
  const primario = useRef<HTMLAnchorElement | null>(null);
  const [reintentando, setReintentando] = useState(false);

  /**
   * Con un mando, el foco empieza en «Ver la tele en directo».
   *
   * Sin esto la primera flecha partía de la nada y caía en el logo de la
   * barra; en esta pantalla solo hay dos cosas que hacer, así que se deja a
   * la persona encima de la primera. Solo si nada tiene ya el foco: `<Activity>`
   * puede estar devolviendo esta ruta con el foco donde se dejó, y pisarlo
   * sería perderle el sitio. Con el dedo o el ratón no se hace: un aro blanco
   * al abrir parece un fallo de pintado.
   */
  useEffect(() => {
    const esMando =
      document.documentElement.dataset.input === "dpad" || esTelevisorUA(navigator.userAgent);
    const libre = !document.activeElement || document.activeElement === document.body;
    if (esMando && libre) primario.current?.focus({ preventScroll: true });
  }, []);

  /** Un solo `refresh` por pulsación; el botón se apaga mientras tanto. */
  const reintentar = () => {
    if (reintentando) return;
    setReintentando(true);
    router.refresh();
    // `refresh` no devuelve promesa: si TMDB sigue caído, la página se pinta
    // igual y el botón tiene que volver a estar disponible.
    window.setTimeout(() => setReintentando(false), 4000);
  };

  const sinConfigurar = estado === "sin-configurar";

  return (
    <section className="portada-cine" aria-labelledby="portada-cine-titulo">
      <span className="portada-cine-icono" aria-hidden="true">
        <Clapperboard />
      </span>

      <p className="portada-cine-antetitulo">Cine y series</p>
      <h1 className="portada-cine-titulo" id="portada-cine-titulo">
        {sinConfigurar
          ? "Las películas y series llegan pronto"
          : "Ahora mismo no podemos mostrar películas ni series"}
      </h1>
      <p className="portada-cine-texto">
        {sinConfigurar
          ? "Mientras tanto, puedes ver la tele en directo o abrir un vídeo con tu propio enlace."
          : "Suele arreglarse solo en unos minutos. La tele en directo funciona como siempre."}
      </p>

      <div className="portada-cine-acciones">
        <Link
          ref={primario}
          href="/?vista=canales"
          className="primary portada-cine-boton"
          data-nav="button"
        >
          <Tv aria-hidden="true" />
          Ver la tele en directo
        </Link>

        {sinConfigurar ? (
          <Link href="/?vista=fuente" className="secondary portada-cine-boton" data-nav="button">
            <Link2 aria-hidden="true" />
            Abrir Mi enlace
          </Link>
        ) : (
          <button
            type="button"
            className="secondary portada-cine-boton"
            data-nav="button"
            onClick={reintentar}
            aria-disabled={reintentando}
          >
            <RotateCw aria-hidden="true" className={reintentando ? "portada-cine-girando" : undefined} />
            {reintentando ? "Intentando…" : "Volver a intentar"}
          </button>
        )}
      </div>

      {aviso}
    </section>
  );
}
