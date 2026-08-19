"use client";

const SHORTCUTS: [string, string][] = [
  ["↑ ↓", "Cambiar canal"],
  ["PgUp PgDn", "Salto de 10"],
  ["← →", "Cambiar categoría"],
  ["0-9", "Ir al canal"],
  ["Espacio", "Play / Pausa"],
  ["M", "Silenciar"],
  ["F", "Pantalla completa"],
  ["Enter", "Marcar favorito"],
  ["?", "Mostrar atajos"],
  ["Esc", "Cerrar"],
];

export function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative mb-5 rounded-2xl border border-teal-200 bg-teal-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-teal-600">Atajos de control remoto</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar atajos"
          className="rounded-lg p-1.5 text-slate-500 transition hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        {SHORTCUTS.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-slate-700">
            <kbd className="rounded border border-slate-300 bg-slate-100 px-2 py-1 font-mono text-xs">{key}</kbd>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
