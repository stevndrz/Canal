"use client";

import { useRef } from "react";
import { Languages, MonitorPlay } from "lucide-react";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import type { EmbedProvider } from "@/lib/catalog/providers";

/**
 * Botonera para cambiar de servidor de video.
 *
 * El cambio es manual, y no por elección estética: el reproductor va dentro de
 * un iframe de otro dominio, así que desde aquí **no se puede saber si cargó,
 * si falló o en qué idioma está**. Un "cambio automático al fallar" tendría que
 * adivinar, y adivinaría mal: el evento `load` se dispara igual cuando el
 * proveedor devuelve una página de error. Un botón grande y visible es honesto
 * y, con un control remoto, más rápido que cualquier detección.
 *
 * Se numeran ("Servidor 1", "Servidor 2") a propósito: quien está delante de la
 * tele no tiene por qué saber qué es VidSrc.
 */
export function ServerPicker({
  providers,
  activeId,
  onSelect,
}: {
  providers: EmbedProvider[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  useGridNavigation(listRef, "[data-server]");

  if (providers.length < 2) return null;

  return (
    <div className="mt-4 flex flex-col items-center">
      <div className="mb-2.5 flex items-center gap-2 text-center text-sm text-white/60">
        <MonitorPlay aria-hidden="true" className="h-4 w-4" />
        <span>¿No se ve o está en otro idioma? Cambia de servidor:</span>
      </div>

      <div
        ref={listRef}
        className="flex flex-wrap justify-center gap-2"
        role="group"
        aria-label="Servidor de video"
      >
        {providers.map((provider) => {
          const active = provider.id === activeId;
          return (
            <button
              key={provider.id}
              type="button"
              data-server
              onClick={() => onSelect(provider.id)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400 ${
                active
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md"
                  : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {provider.label}
              {provider.spanishSubtitles && (
                <Languages
                  aria-label="Pide subtítulos en español"
                  className={`h-3.5 w-3.5 ${active ? "text-violet-100" : "text-emerald-300/70"}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
