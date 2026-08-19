"use client";

import { MonitorCog } from "lucide-react";
import { useAppStore, useStoreHydrated } from "@/store/use-app-store";

/**
 * Ajustes de imagen pensados para el televisor.
 *
 * Se exponen en la interfaz (y no como constantes) porque la respuesta
 * correcta depende del aparato: cuánto aguanta su GPU y cómo se ve el escalado
 * en su panel solo se sabe mirándolo.
 */
export function DisplaySettings() {
  const tvMode = useAppStore((state) => state.tvMode);
  const setTvMode = useAppStore((state) => state.setTvMode);
  const sharpness = useAppStore((state) => state.sharpness);
  const setSharpness = useAppStore((state) => state.setSharpness);
  const hydrated = useStoreHydrated();

  // Hasta leer localStorage se muestran los valores por defecto, para que el
  // HTML del servidor y el del navegador coincidan.
  const currentTvMode = hydrated && tvMode;
  const currentSharpness = hydrated ? sharpness : "smooth";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
        <MonitorCog aria-hidden="true" className="h-4 w-4" />
        Imagen
      </span>

      <button
        type="button"
        onClick={() => setTvMode(!currentTvMode)}
        aria-pressed={currentTvMode}
        title="Desactiva desenfoques y sombras pesadas: la TV va más fluida"
        className={`rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 ${
          currentTvMode
            ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white"
            : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
        }`}
      >
        Modo TV
      </button>

      <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {(["smooth", "sharp"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setSharpness(mode)}
            aria-pressed={currentSharpness === mode}
            className={`px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 ${
              currentSharpness === mode ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {mode === "smooth" ? "Suave" : "Nítido"}
          </button>
        ))}
      </div>
    </div>
  );
}
