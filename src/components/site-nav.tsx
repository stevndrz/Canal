"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Tv } from "lucide-react";

/**
 * Navegación principal. Dos destinos grandes, con foco muy visible: en una TV
 * el usuario no ve un cursor, solo el recuadro de foco, así que tiene que
 * cantar a tres metros de distancia.
 */
const SECTIONS = [
  { href: "/", label: "Canales", icon: Tv },
  { href: "/peliculas", label: "Películas y Series", icon: Clapperboard },
] as const;

export function SiteNav({ tone = "light" }: { tone?: "light" | "dark" }) {
  const pathname = usePathname();
  const dark = tone === "dark";

  return (
    <nav aria-label="Secciones" className="flex gap-2">
      {SECTIONS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-bold shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 sm:px-4 sm:py-2.5 ${
              active
                ? dark
                  ? "bg-violet-600 text-white shadow-md"
                  : "bg-emerald-600 text-white shadow-md"
                : dark
                  ? "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            {/* En el teléfono solo el icono: estos dos botones eran, con
                diferencia, lo más ancho de la barra y lo que la desbordaba.
                El nombre sigue ahí para lectores de pantalla y como `title`. */}
            <span className="hidden md:inline">{label}</span>
            <span className="sr-only md:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
