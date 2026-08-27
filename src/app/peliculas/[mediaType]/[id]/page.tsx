import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TitleDetail } from "@/components/catalog/title-detail";
import { findCatalogItem, resolveItem, resolveSeason } from "@/lib/catalog/catalog";
import type { MediaType } from "@/lib/catalog/types";
import { esTelevisorUA } from "@/lib/dispositivo";
import { numerarServidores, servidoresEmbed } from "@/lib/catalog/providers";
import { servidoresConElTitulo } from "@/lib/catalog/disponibilidad";

/**
 * La lectura de `headers()` —saber si quien pide es un televisor para
 * reordenar los servidores— es dinámica por naturaleza: cachearla serviría el
 * orden equivocado a la mitad de los dispositivos, y en un Samsung eso es el
 * bucle de recargas. Vive dentro del `<Suspense>`, junto a params y
 * searchParams; la raíz queda limpia y también aquí el armazón se prerenderiza.
 */

interface PropsDeFicha {
  params: Promise<{ mediaType: string; id: string }>;
  searchParams: Promise<{ t?: string }>;
}

async function Ficha({ params, searchParams }: PropsDeFicha) {
  const { mediaType, id } = await params;
  if (mediaType !== "movie" && mediaType !== "tv") notFound();

  const item = findCatalogItem(mediaType as MediaType, id);
  if (!item) notFound();

  const resolved = await resolveItem(item);

  // La temporada llega por query (?t=2) para que el enlace sea compartible y
  // el botón de retroceso del navegador funcione como se espera.
  const { t } = await searchParams;
  const requested = Number(t);
  const selectedSeason =
    Number.isFinite(requested) && resolved.seasons.includes(requested)
      ? requested
      : (resolved.seasons[0] ?? 1);

  const episodes = mediaType === "tv" ? await resolveSeason(item, selectedSeason) : [];

  // Aquí y no en el cliente: el respaldo de la ficha se elige en el primer
  // render, y corregirlo al hidratar llegaría tarde. Ver `esTelevisorUA`.
  const enTelevisor = esTelevisorUA((await headers()).get("user-agent") ?? "");

  /**
   * Los servidores que de verdad tienen el título, **antes de pintar nada**.
   *
   * Es lo que hace que el primer fotograma ya sea un servidor que lo tiene, en
   * vez de enseñar el «Not Found» de Vimeus un segundo y corregirlo cuando
   * responda `/api/stream`. Ver `disponibilidad.ts` para qué se pregunta y por
   * qué solo a dos proveedores.
   *
   * El coste de tiempo es cero: esta página ya espera a TMDB más arriba, y las
   * comprobaciones salen todas en paralelo con un tope de 2,5 s. Si alguna
   * falla, su servidor se conserva.
   */
  const tmdbId = resolved.tmdbId ?? null;
  const servidoresIniciales = tmdbId
    ? numerarServidores(
        await servidoresConElTitulo(
          servidoresEmbed(
            mediaType as MediaType,
            { tmdbId, season: selectedSeason, episode: 1 },
            enTelevisor,
          ),
        ),
      )
    : [];

  return (
    <TitleDetail
      item={resolved}
      episodes={episodes}
      selectedSeason={selectedSeason}
      enTelevisor={enTelevisor}
      servidoresIniciales={servidoresIniciales}
    />
  );
}

export default function TitlePage(props: PropsDeFicha) {
  return (
    <Suspense fallback={<div className="app-shell bg-black" />}>
      <Ficha {...props} />
    </Suspense>
  );
}
