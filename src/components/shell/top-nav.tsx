"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Settings, Tv } from "lucide-react";
import type { ViewId } from "@/lib/types";
import { NAV_ITEMS, MOBILE_KEYS, type NavItem } from "@/components/app-nav";

/**
 * Barra de navegación del shell.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/shell/TopNav.tsx
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b):
 *   - Fuera el sistema de perfiles (avatar, cambio de perfil, nombre): CanalCasa
 *     no tiene cuentas. Ese hueco de la rejilla lo ocupa la marca y el reloj.
 *   - Fuera la marca ARVIO: su logotipo y su nombre quedan fuera de la licencia
 *     (§6). Aquí va el monograma propio.
 *   - Los destinos salen de NAV_ITEMS, que admite tanto vistas del shell como
 *     rutas de Next; ARVIO solo tiene lo primero.
 *   - Añadido `data-nav` para que use-spatial-nav siga viendo estos botones, y
 *     `data-nav-chrome` en las tres barras: al ser fijas están siempre pegadas
 *     al borde, así que sin marcarlas ganaban cualquier movimiento vertical y
 *     el foco no podía volver al riel de encima.
 *
 * Se conservan intactos sus nombres de clase (.sidebar, .nav-item,
 * .mobile-header, .mobile-bottom-nav…) porque son el contrato con
 * arvio-shell.css: renombrarlos obligaría a tocar 12.000 líneas de CSS.
 *
 * Cuidado con `.sidebar`: pese al nombre es una barra superior fija, no una
 * columna lateral. La rejilla de tres columnas reparte marca | destinos | ajustes.
 */

interface TopNavProps {
  /**
   * Vista activa del App Shell.
   *
   * Opcional porque la barra también se pinta en rutas que viven fuera del
   * shell —`/peliculas`—, donde no hay ninguna vista: allí la sección activa la
   * decide la URL. Antes esas rutas no tenían barra y cambiar de sección se
   * sentía como salir de la aplicación.
   */
  view?: ViewId;
  /**
   * Cambiar de vista dentro del shell. Sin ella, la barra navega a `/` con la
   * vista pedida en la URL, que es lo que necesitan las rutas de fuera.
   */
  onNavigate?: (view: ViewId) => void;
}

function isActive(item: NavItem, view: ViewId | undefined, pathname: string): boolean {
  if (item.kind === "link") return pathname.startsWith(item.href);
  // En una ruta de fuera del shell ninguna vista está activa: manda el enlace.
  if (view === undefined) return false;
  return view === item.key || (item.key === "canales" && view === "player");
}

/** Ajustes vive en el engranaje de la derecha, no entre los destinos. */
const AJUSTES = NAV_ITEMS.find((item) => item.key === "ajustes");
const DESTINOS = NAV_ITEMS.filter((item) => item.key !== "ajustes");

export function TopNav({ view, onNavigate }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [clock, setClock] = useState("");

  // El reloj lo lleva la barra y no quien la usa: es parte del chrome, y así
  // funciona igual dentro y fuera del shell sin que nadie tenga que pasárselo.
  useEffect(() => {
    const update = () =>
      setClock(new Date().toLocaleTimeString("es-GT", { hour: "numeric", minute: "2-digit" }));
    update();
    const timer = setInterval(update, 20_000);
    return () => clearInterval(timer);
  }, []);

  const irA = (destino: ViewId) => {
    if (onNavigate) onNavigate(destino);
    // Fuera del shell no hay estado de vista que cambiar: se vuelve a la
    // aplicación pidiendo la sección por la URL.
    else router.push(destino === "home" ? "/" : `/?vista=${destino}`);
  };

  // La barra se opaca al bajar. Mientras el shell siga sin scrollear la
  // ventana esto no se dispara nunca, y no molesta: cuando el modelo de
  // scroll cambie, la barra ya está preparada.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const renderItem = (item: NavItem, className: string) => {
    const { key, label, Icon } = item;
    const active = isActive(item, view, pathname);
    const content = (
      <>
        <Icon aria-hidden="true" />
        <span>{label}</span>
      </>
    );

    if (item.kind === "link") {
      return (
        <Link
          key={key}
          href={item.href}
          data-nav="button"
          title={label}
          aria-current={active ? "page" : undefined}
          className={`${className} ${active ? "is-active" : ""}`}
        >
          {content}
        </Link>
      );
    }
    return (
      <button
        key={key}
        type="button"
        data-nav="button"
        title={label}
        aria-current={active ? "page" : undefined}
        onClick={() => irA(item.key)}
        className={`${className} ${active ? "is-active" : ""}`}
      >
        {content}
      </button>
    );
  };

  const ajustesActivo = AJUSTES ? isActive(AJUSTES, view, pathname) : false;

  return (
    <>
      {/* Escritorio y TV */}
      <aside className={`sidebar ${scrolled ? "is-scrolled" : ""}`} aria-label="Secciones" data-nav-chrome>
        <div className="profile-cluster">
          <span className="brand" aria-hidden="true">
            <Tv strokeWidth={1.5} />
          </span>
          <span className="profile-name-text">CanalCasa</span>
        </div>

        <nav>{DESTINOS.map((item) => renderItem(item, "nav-item"))}</nav>

        <div className="top-right">
          <span className="top-clock">{clock}</span>
          <button
            type="button"
            data-nav="button"
            title="Ajustes"
            aria-label="Ajustes"
            aria-current={ajustesActivo ? "page" : undefined}
            onClick={() => irA("ajustes")}
            className={`settings-gear ${ajustesActivo ? "is-active" : ""}`}
          >
            <Settings />
          </button>
        </div>
      </aside>

      {/* Teléfono: cabecera arriba… */}
      <header className={`mobile-header ${scrolled ? "is-scrolled" : ""}`} data-nav-chrome>
        <div className="mobile-brand">
          <span className="brand" aria-hidden="true">
            <Tv strokeWidth={1.5} />
          </span>
          <span className="profile-name-text">CanalCasa</span>
        </div>
        <span className="top-clock">{clock}</span>
      </header>

      {/* …y destinos abajo, donde llega el pulgar. */}
      <nav className="mobile-bottom-nav" aria-label="Secciones" data-nav-chrome>
        {NAV_ITEMS.filter((item) => MOBILE_KEYS.includes(item.key)).map((item) =>
          renderItem(item, "mobile-nav-item"),
        )}
      </nav>
    </>
  );
}
