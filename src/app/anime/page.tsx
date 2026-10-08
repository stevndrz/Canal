import { PaginaCatalogo } from "@/components/catalog/pagina-catalogo";
import type { Filtro } from "@/components/catalog/seccion-catalogo";

export default function AnimePage({ searchParams }: { searchParams: Promise<Filtro> }) {
  return <PaginaCatalogo seccion="anime" searchParams={searchParams} />;
}
