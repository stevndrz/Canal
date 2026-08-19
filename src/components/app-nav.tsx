"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Heart, House, LayoutGrid, Search, Settings, Tv, type LucideIcon } from "lucide-react";
import type { ViewId } from "@/lib/types";

/**
 * Dos formas de entrada en la barra: cambiar de vista dentro del App Shell
 * (`view`), o navegar a una ruta de Next aparte (`link`). Películas y Series
 * vive en su propia ruta —`/peliculas`, con su catálogo de TMDB, buscador y
 * fichas— y no como una `view` más: reescribir ese subsistema dentro del
 * modelo de vistas del diseño era trabajo grande sin beneficio real.
 */
interface ViewNavItem {
  kind: "view";
  key: ViewId;
  label: string;
  Icon: LucideIcon;
}
interface LinkNavItem {
  kind: "link";
  key: string;
  href: string;
  label: string;
  Icon: LucideIcon;
}
type NavItem = ViewNavItem | LinkNavItem;

export const NAV_ITEMS: NavItem[] = [
  { kind: "view", key: "home", label: "Inicio", Icon: House },
  { kind: "view", key: "canales", label: "Canales", Icon: Tv },
  { kind: "link", key: "peliculas", href: "/peliculas", label: "Películas", Icon: Clapperboard },
  { kind: "view", key: "favoritos", label: "Favoritos", Icon: Heart },
  { kind: "view", key: "buscar", label: "Buscar", Icon: Search },
  { kind: "view", key: "categorias", label: "Categorías", Icon: LayoutGrid },
  { kind: "view", key: "ajustes", label: "Ajustes", Icon: Settings },
];

/** Las que caben en la barra inferior del teléfono. */
const MOBILE_KEYS = ["home", "canales", "peliculas", "favoritos", "ajustes"];

interface AppNavProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  channelCount: number;
  categoryCount: number;
  clock: string;
}

function isActive(item: NavItem, view: ViewId, pathname: string): boolean {
  if (item.kind === "link") return pathname.startsWith(item.href);
  return view === item.key || (item.key === "canales" && view === "player");
}

/** Sidebar de escritorio/TV: etiquetas completas en ≥1200px, sólo iconos debajo. */
export function AppSidebar({ view, onNavigate, channelCount, categoryCount, clock }: AppNavProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[92px] shrink-0 flex-col gap-1 border-r border-white/[0.07] px-3.5 pt-7 pb-5 md:flex xl:w-[264px] xl:pt-10">
      <div className="flex items-center gap-3 px-2.5 pb-6">
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-accent text-accent-on">
          <Tv aria-hidden="true" strokeWidth={1.5} className="h-[21px] w-[21px]" />
        </span>
        <span className="hidden text-[19px] font-semibold tracking-tight xl:inline">CanalCasa</span>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Secciones">
        {NAV_ITEMS.map((item) => {
          const { key, label, Icon } = item;
          const active = isActive(item, view, pathname);
          const className = `flex min-h-[52px] items-center gap-3.5 rounded-[13px] px-3.5 text-base font-medium ${
            active
              ? "bg-accent text-accent-on"
              : "text-zinc-400 hover:bg-white/[0.08] hover:text-accent"
          }`;
          const content = (
            <>
              <Icon aria-hidden="true" strokeWidth={1.5} className="h-[22px] w-[22px] shrink-0" />
              <span className="hidden xl:inline">{label}</span>
            </>
          );

          if (item.kind === "link") {
            return (
              <Link key={key} href={item.href} data-nav="button" title={label} className={className}>
                {content}
              </Link>
            );
          }
          return (
            <button
              key={key}
              type="button"
              data-nav="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(item.key)}
              title={label}
              className={className}
            >
              {content}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto hidden flex-col gap-1.5 border-t border-white/[0.07] px-2.5 pt-3.5 xl:flex">
        <span className="text-xs uppercase tracking-[0.14em] text-zinc-600">Lista</span>
        <span className="text-sm text-zinc-400">
          {channelCount} canales · {categoryCount} categorías
        </span>
        <span className="text-[13px] text-zinc-600">{clock}</span>
      </div>
    </aside>
  );
}

/** Barra flotante de móvil/tablet. Acrílico sobre el contenido, no un footer. */
export function AppBottomNav({ view, onNavigate }: Pick<AppNavProps, "view" | "onNavigate">) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => MOBILE_KEYS.includes(item.key));

  return (
    <nav
      aria-label="Secciones"
      className="absolute inset-x-4 bottom-[18px] flex h-[66px] items-center justify-around gap-1 rounded-[22px] border border-white/10 bg-surface-2/70 px-2 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)] backdrop-blur-xl md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const { key, label, Icon } = item;
        const active = isActive(item, view, pathname);
        const className = `flex min-h-[50px] min-w-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-[15px] ${
          active ? "bg-white/10 text-accent" : "text-zinc-500"
        }`;
        const content = (
          <>
            <Icon aria-hidden="true" strokeWidth={1.5} className="h-[21px] w-[21px]" />
            <span className="text-[11px]">{label}</span>
          </>
        );

        if (item.kind === "link") {
          return (
            <Link key={key} href={item.href} aria-current={active ? "page" : undefined} className={className}>
              {content}
            </Link>
          );
        }
        return (
          <button
            key={key}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate(item.key)}
            className={className}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}
