import { PaginaCatalogo } from "@/components/catalog/pagina-catalogo";
import type { Filtro } from "@/components/catalog/seccion-catalogo";

export default function PeliculasPage({ searchParams }: { searchParams: Promise<Filtro> }) {
  return <PaginaCatalogo seccion="peliculas" searchParams={searchParams} />;
}
