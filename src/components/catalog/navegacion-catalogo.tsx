"use client";

import { useRef, type ReactNode } from "react";
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
export function NavegacionCatalogo({ children }: { children: ReactNode }) {
  const router = useRouter();
  const raiz = useRef<HTMLDivElement | null>(null);

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
