import Link from "next/link";
import { Clapperboard, Info, Tv } from "lucide-react";
import { CatalogRows } from "@/components/catalog/catalog-row";
import { groupByCollection, resolveCatalog } from "@/lib/catalog/catalog";
import { isTmdbConfigured } from "@/lib/catalog/tmdb";

export const dynamic = "force-dynamic";

export default async function MoviesPage() {
  const items = await resolveCatalog();
  const rows = groupByCollection(items);
  const tmdbReady = isTmdbConfigured();

  return (
    // Fondo oscuro a propósito: es lo que se espera de una sección de cine y
    // además reduce el brillo en una TV grande de noche.
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6 md:px-8 md:py-6">
        <header className="mb-5 flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-900/40">
            <Clapperboard aria-hidden="true" className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Películas y Series</h1>
        </header>

        <nav aria-label="Secciones" className="mb-6 flex gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 sm:text-base"
          >
            <Tv aria-hidden="true" className="h-5 w-5" />
            Canales
          </Link>
          <span
            aria-current="page"
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-bold shadow-md sm:text-base"
          >
            <Clapperboard aria-hidden="true" className="h-5 w-5" />
            Películas y Series
          </span>
        </nav>

        {!tmdbReady && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-semibold">Falta la clave de TMDB</p>
              <p className="mt-1 text-amber-100/80">
                Se están mostrando solo los datos escritos en{" "}
                <code className="rounded bg-black/30 px-1">src/data/catalog.json</code>. Añade{" "}
                <code className="rounded bg-black/30 px-1">TMDB_API_KEY</code> en{" "}
                <code className="rounded bg-black/30 px-1">.env.local</code> para que los pósters y
                los episodios se rellenen solos.
              </p>
            </div>
          </div>
        )}

        {rows.length > 0 ? (
          <CatalogRows sections={rows} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <Clapperboard aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-white/40" />
            <p className="font-medium text-white/80">Tu catálogo está vacío</p>
            <p className="mt-1 text-sm text-white/50">
              Agrega títulos en <code className="rounded bg-black/30 px-1">src/data/catalog.json</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
