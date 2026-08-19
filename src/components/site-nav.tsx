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

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="flex gap-2">
      {SECTIONS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 sm:text-base ${
              active
                ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
