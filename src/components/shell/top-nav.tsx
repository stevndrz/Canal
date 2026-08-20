"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  clock: string;
}

function isActive(item: NavItem, view: ViewId, pathname: string): boolean {
  if (item.kind === "link") return pathname.startsWith(item.href);
  return view === item.key || (item.key === "canales" && view === "player");
}

/** Ajustes vive en el engranaje de la derecha, no entre los destinos. */
const AJUSTES = NAV_ITEMS.find((item) => item.key === "ajustes");
const DESTINOS = NAV_ITEMS.filter((item) => item.key !== "ajustes");

export function TopNav({ view, onNavigate, clock }: TopNavProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

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
        onClick={() => onNavigate(item.key)}
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
            onClick={() => onNavigate("ajustes")}
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
