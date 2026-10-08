import { PaginaCatalogo } from "@/components/catalog/pagina-catalogo";
import type { Filtro } from "@/components/catalog/seccion-catalogo";

export default function SeriesPage({ searchParams }: { searchParams: Promise<Filtro> }) {
  return <PaginaCatalogo seccion="series" searchParams={searchParams} />;
}
