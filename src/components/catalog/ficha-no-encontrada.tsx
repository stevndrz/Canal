"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Clapperboard, SearchX, Tv } from "lucide-react";
import { TopNav } from "@/components/shell/top-nav";
import { esTelevisorUA } from "@/lib/dispositivo";
import { NavegacionCatalogo } from "./navegacion-catalogo";

/**
 * Cuando el título no existe, o TMDB no lo devuelve.
 *
 * Antes la ficha se abría igual, con «Sin título» de cabecera y un
 * reproductor buscando algo que no hay: cualquier `tmdb-N` de la URL se
 * aceptaba sin preguntar. Ahora se dice lo que pasa, con las mismas piezas
 * que la portada de bienvenida, y se ofrece volver al catálogo.
 *
 * Con un mando el foco empieza en «Volver al catálogo», por lo mismo que
 * en la portada: es lo único que hay que hacer aquí.
 */
export function FichaNoEncontrada() {
  const primario = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const esMando =
      document.documentElement.dataset.input === "dpad" || esTelevisorUA(navigator.userAgent);
    const libre = !document.activeElement || document.activeElement === document.body;
    if (esMando && libre) primario.current?.focus({ preventScroll: true });
  }, []);

  return (
    <NavegacionCatalogo subirAlAbrir>
      <div className="app-shell">
        <TopNav />
        <section className="portada-cine" aria-labelledby="ficha-no-encontrada">
          <span className="portada-cine-icono" aria-hidden="true">
            <SearchX />
          </span>
          <h1 className="portada-cine-titulo" id="ficha-no-encontrada">
            No encontramos este título
          </h1>
          <p className="portada-cine-texto">
            Puede que ya no esté disponible o que ahora mismo no podamos consultarlo.
          </p>
          <div className="portada-cine-acciones">
            <Link ref={primario} href="/peliculas" className="primary portada-cine-boton" data-nav="button">
              <Clapperboard aria-hidden="true" />
              Volver al catálogo
            </Link>
            <Link href="/?vista=canales" className="secondary portada-cine-boton" data-nav="button">
              <Tv aria-hidden="true" />
              Ver la tele en directo
            </Link>
          </div>
        </section>
      </div>
    </NavegacionCatalogo>
  );
}
