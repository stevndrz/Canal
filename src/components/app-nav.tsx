import { Clapperboard, Heart, House, LayoutGrid, Link2, Search, Settings, Tv, type LucideIcon } from "lucide-react";
import type { ViewId } from "@/lib/types";

/**
 * El modelo de navegación: qué destinos existen y de qué tipo es cada uno.
 *
 * Aquí no se pinta nada. La barra que los dibuja vive en
 * `src/components/shell/top-nav.tsx`; separarlos deja el modelo estable
 * mientras la presentación cambia.
 *
 * Dos formas de entrada: cambiar de vista dentro del App Shell (`view`), o
 * navegar a una ruta de Next aparte (`link`). Películas y Series vive en su
 * propia ruta —`/peliculas`, con su catálogo de TMDB, buscador y fichas— y no
 * como una `view` más: reescribir ese subsistema dentro del modelo de vistas
 * del diseño era trabajo grande sin beneficio real.
 */
interface ViewNavItem {
  kind: "view";
  key: ViewId;
  label: string;
  Icon: LucideIcon;
}
interface LinkNavItem {
  kind: "link";
  key: string;
  href: string;
  label: string;
  Icon: LucideIcon;
}
export type NavItem = ViewNavItem | LinkNavItem;

export const NAV_ITEMS: NavItem[] = [
  { kind: "view", key: "home", label: "Inicio", Icon: House },
  { kind: "view", key: "canales", label: "Canales", Icon: Tv },
  { kind: "link", key: "peliculas", href: "/peliculas", label: "Películas", Icon: Clapperboard },
  { kind: "view", key: "fuente", label: "Mi enlace", Icon: Link2 },
  { kind: "view", key: "favoritos", label: "Favoritos", Icon: Heart },
  { kind: "view", key: "buscar", label: "Buscar", Icon: Search },
  { kind: "view", key: "categorias", label: "Categorías", Icon: LayoutGrid },
  { kind: "view", key: "ajustes", label: "Ajustes", Icon: Settings },
];

/**
 * Destinos de la barra inferior del teléfono.
 *
 * Están **los siete**. Antes había cinco y, como la barra superior se oculta
 * por debajo de 680px, Buscar y Categorías quedaban sin ninguna forma de
 * llegar a ellas desde un teléfono: dos secciones enteras inaccesibles. Con
 * siete cada casilla mide unos 55px de ancho en una pantalla de 390px, por
 * encima del mínimo táctil recomendado de 44px.
 */
export const MOBILE_KEYS = NAV_ITEMS.map((item) => item.key);
