import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TitleDetail } from "@/components/catalog/title-detail";
import { findCatalogItem, resolveItem, resolveSeason } from "@/lib/catalog/catalog";
import type { MediaType } from "@/lib/catalog/types";
import { esTelevisorUA } from "@/lib/dispositivo";

export const dynamic = "force-dynamic";

export default async function TitlePage({
  params,
  searchParams,
}: {
  params: Promise<{ mediaType: string; id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
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

  /**
   * Si esto es un televisor se decide AQUÍ, con la cabecera de la petición.
   *
   * El reproductor elige un servidor de respaldo en el primer render, antes de
   * que llegue `/api/stream`. Si esa elección se corrigiera al hidratar, el
   * marco ya habría empezado a cargar el proveedor con puerta antirrobot y su
   * bucle de recargas ya estaría en marcha: llega tarde.
   */
  const enTelevisor = esTelevisorUA((await headers()).get("user-agent") ?? "");

  return (
    <TitleDetail
      item={resolved}
      episodes={episodes}
      selectedSeason={selectedSeason}
      enTelevisor={enTelevisor}
    />
  );
}
