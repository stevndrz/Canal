"use client";

import { Heart, House, LayoutGrid, Search, Settings, Tv } from "lucide-react";
import type { ViewId } from "@/lib/types";

export const NAV_ITEMS = [
  { id: "home", label: "Inicio", Icon: House },
  { id: "canales", label: "Canales", Icon: Tv },
  { id: "favoritos", label: "Favoritos", Icon: Heart },
  { id: "buscar", label: "Buscar", Icon: Search },
  { id: "categorias", label: "Categorías", Icon: LayoutGrid },
  { id: "ajustes", label: "Ajustes", Icon: Settings },
] as const satisfies ReadonlyArray<{ id: ViewId; label: string; Icon: typeof House }>;

/** Las 5 que caben en la barra inferior del teléfono. */
const MOBILE_IDS: ViewId[] = ["home", "canales", "buscar", "favoritos", "ajustes"];

interface AppNavProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  channelCount: number;
  categoryCount: number;
  clock: string;
}

/** Sidebar de escritorio/TV: etiquetas completas en ≥1200px, sólo iconos debajo. */
export function AppSidebar({ view, onNavigate, channelCount, categoryCount, clock }: AppNavProps) {
  return (
    <aside className="hidden w-[92px] shrink-0 flex-col gap-1 border-r border-white/[0.07] px-3.5 pt-7 pb-5 md:flex xl:w-[264px] xl:pt-10">
      <div className="flex items-center gap-3 px-2.5 pb-6">
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-accent text-accent-on">
          <Tv aria-hidden="true" strokeWidth={1.5} className="h-[21px] w-[21px]" />
        </span>
        <span className="hidden text-[19px] font-semibold tracking-tight xl:inline">CanalCasa</span>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Secciones">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = view === id || (id === "canales" && view === "player");
          return (
            <button
              key={id}
              type="button"
              data-nav="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(id)}
              title={label}
              className={`flex min-h-[52px] items-center gap-3.5 rounded-[13px] px-3.5 text-base font-medium ${
                active
                  ? "bg-accent text-accent-on"
                  : "text-zinc-400 hover:bg-white/[0.08] hover:text-accent"
              }`}
            >
              <Icon aria-hidden="true" strokeWidth={1.5} className="h-[22px] w-[22px] shrink-0" />
              <span className="hidden xl:inline">{label}</span>
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
  const items = NAV_ITEMS.filter((item) => MOBILE_IDS.includes(item.id));

  return (
    <nav
      aria-label="Secciones"
      className="absolute inset-x-4 bottom-[18px] flex h-[66px] items-center justify-around gap-1 rounded-[22px] border border-white/10 bg-surface-2/70 px-2 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)] backdrop-blur-xl md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map(({ id, label, Icon }) => {
        const active = view === id || (id === "canales" && view === "player");
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate(id)}
            className={`flex min-h-[50px] min-w-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-[15px] ${
              active ? "bg-white/10 text-accent" : "text-zinc-500"
            }`}
          >
            <Icon aria-hidden="true" strokeWidth={1.5} className="h-[21px] w-[21px]" />
            <span className="text-[11px]">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
