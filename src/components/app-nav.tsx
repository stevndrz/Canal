import { Clapperboard, House, Link2, Search, Settings, Tv, type LucideIcon } from "lucide-react";
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
  /* «Cine y series» y no «Películas»: la sección trae las dos cosas, y el
     nombre viejo hacía pensar que las series estaban en otro sitio. La ruta
     sigue siendo /peliculas para no romper enlaces ni el `?vista=` de vuelta
     al shell. */
  { kind: "link", key: "peliculas", href: "/peliculas", label: "Cine y series", Icon: Clapperboard },
  { kind: "view", key: "fuente", label: "Mi enlace", Icon: Link2 },
  { kind: "view", key: "buscar", label: "Buscar", Icon: Search },
  { kind: "view", key: "ajustes", label: "Ajustes", Icon: Settings },
];

/**
 * Destinos de la barra inferior del teléfono, en dos grupos.
 *
 * Los siete no caben. En un iPhone de 393px cada casilla quedaba en 49px: por
 * encima del mínimo táctil de 44px, sí, pero con la etiqueta partida a
 * «Categoría…» y todo apelmazado. Y las etiquetas no son opcionales aquí —
 * esta aplicación la usa gente que reconoce la palabra antes que el icono.
 *
 * Así que cuatro a la vista y el resto detrás de «Más», que es el patrón que
 * cualquiera ya conoce de su teléfono. Los cuatro elegidos son los que se usan
 * mientras se ve algo; los otros se visitan de vez en cuando. Favoritos ya no
 * es uno de los siete: vive como riel en Inicio («Tus favoritos»), no como
 * pantalla propia — ver `home-view.tsx`.
 *
 * Ninguna sección queda inalcanzable, que fue el motivo de meterlas todas en
 * su día: la barra superior se oculta por debajo de 680px, así que lo que no
 * esté aquí no existe en un teléfono.
 */
export const MOBILE_PRIMARY_KEYS: NavItem["key"][] = [
  "home",
  "canales",
  "peliculas",
  "buscar",
];

export const MOBILE_OVERFLOW_KEYS: NavItem["key"][] = NAV_ITEMS.map((item) => item.key).filter(
  (key) => !MOBILE_PRIMARY_KEYS.includes(key),
);
