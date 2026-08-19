"use client";

import type { ReactNode } from "react";
import { Tv } from "lucide-react";
import { SiteNav } from "./site-nav";

/**
 * Barra superior común a todas las secciones.
 *
 * Antes cada sección pintaba su propio encabezado: Canales tenía una barra
 * delgada y Películas un mosaico con degradado y un título enorme. Cambiar de
 * una a otra se sentía como saltar a otro sitio web, y esa era la causa real,
 * no la falta de animación.
 *
 * El reparto responsive está medido: la fila envuelve y el hueco central (el
 * buscador) baja a su propia línea hasta `sm`. Meter todo en una fila fija es
 * lo que desbordaba la pantalla en un teléfono de 360 px.
 */
export function AppBar({
  tone = "light",
  children,
  actions,
}: {
  /** Las dos secciones conservan su color; la estructura es la misma. */
  tone?: "light" | "dark";
  /** Hueco central, normalmente el buscador de la sección. */
  children?: ReactNode;
  /** Botones extra a la derecha, después de la navegación. */
  actions?: ReactNode;
}) {
  const dark = tone === "dark";

  return (
    <header className="mb-3 flex flex-wrap items-center gap-2">
      <span className={`flex shrink-0 items-center gap-2 ${dark ? "text-white" : "text-slate-900"}`}>
        <Tv aria-hidden="true" className={`h-5 w-5 ${dark ? "text-violet-400" : "text-emerald-600"}`} />
        <h1 className="text-base font-bold tracking-tight">CanalCasa</h1>
      </span>

      {children && (
        <div className="relative order-last min-w-0 flex-1 basis-full sm:order-none sm:basis-auto">
          {children}
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <SiteNav tone={tone} />
        {actions}
      </div>
    </header>
  );
}
