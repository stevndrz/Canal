"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useRemoteInput, useSpatialNav } from "@/hooks/use-spatial-nav";

/**
 * El mando, también fuera del shell.
 *
 * `useSpatialNav` solo se montaba dentro de `Dashboard`, y `/peliculas` y las
 * fichas viven **fuera** de él: tienen su propia página con `TopNav` y nada
 * más. El resultado era que en toda la sección del catálogo las flechas no
 * hacían nada — ni las píldoras de tipo, ni los géneros, ni los rieles, ni la
 * paginación se podían alcanzar con un mando. Solo funcionaban las dos
 * rejillas que traen su `useGridNavigation` propio (episodios y servidores).
 *
 * No se descubrió antes porque con ratón y con el dedo la sección funciona
 * perfectamente; es el mando el que se quedaba fuera.
 *
 * Aquí no hay dígitos que atender —no hay canales que sintonizar— y Atrás
 * devuelve al inicio de la aplicación, que es de donde se llega.
 */
export function NavegacionCatalogo({
  children,
  subirAlAbrir = false,
}: {
  children: ReactNode;
  /**
   * Empezar arriba del todo al entrar.
   *
   * Hace falta en la ficha de un título. Medido: estando en el catálogo a
   * 890px de desplazamiento y pulsando una tarjeta, la ficha abría en 865px
   * —el enrutador conserva la posición porque las dos rutas comparten el mismo
   * armazón—, así que lo primero que se veía era el selector de servidores y
   * la sinopsis. La carátula, el título y el reproductor quedaban fuera de
   * pantalla: parecía que la página había abierto por la mitad.
   *
   * En el catálogo NO se hace, y es a propósito: volver atrás desde una ficha
   * tiene que devolverte donde estabas mirando.
   */
  subirAlAbrir?: boolean;
}) {
  const router = useRouter();
  const raiz = useRef<HTMLDivElement | null>(null);

  /**
   * Antes de pintar, no después.
   *
   * Con `useEffect` el navegador llega a dibujar un fotograma en la posición
   * heredada y se ve el salto. Solo al montar: cambiar de temporada es una
   * navegación más dentro de la misma ficha y ahí subir sería un tirón sin
   * motivo.
   */
  useLayoutEffect(() => {
    if (subirAlAbrir) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRemoteInput();
  useSpatialNav({
    rootRef: raiz,
    onBack: () => router.push("/"),
  });

  return (
    <div ref={raiz} className="contents">
      {children}
    </div>
  );
}
