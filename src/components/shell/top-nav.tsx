"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Ellipsis, Settings, Tv, X } from "lucide-react";
import { useReloj } from "@/hooks/use-reloj";
import type { ViewId } from "@/lib/types";
import {
  NAV_ITEMS,
  MOBILE_OVERFLOW_KEYS,
  MOBILE_PRIMARY_KEYS,
  type NavItem,
} from "@/components/app-nav";

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
 *   - La marca es el monograma propio: ni logotipos ni nombres ajenos.
 *   - Los destinos salen de NAV_ITEMS, que admite tanto vistas del shell como
 *     rutas de Next; el origen solo tenía lo primero.
 *   - Añadido `data-nav` para que use-spatial-nav siga viendo estos botones, y
 *     `data-nav-chrome` en las tres barras: al ser fijas están siempre pegadas
 *     al borde, así que sin marcarlas ganaban cualquier movimiento vertical y
 *     el foco no podía volver al riel de encima.
 *
 * Se conservan intactos sus nombres de clase (.sidebar, .nav-item,
 * .mobile-header, .mobile-bottom-nav…) porque son el contrato con el CSS del
 * shell: renombrarlos obligaría a tocar miles de líneas de estilos.
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

/**
 * La marca —icono de televisión y wordmark— es también un botón hacia el
 * inicio, como se espera del logo en cualquier aplicación. Se usa en las dos
 * barras (escritorio/TV y teléfono); hereda el aspecto de las clases que ya
 * tenía cada una (`profile-cluster` / `mobile-brand`) y `.brand-inicio`
 * desmonta en shell.css el aspecto nativo del botón.
 */
function MarcaInicio({ className, onIr }: { className: string; onIr: () => void }) {
  return (
    <button
      type="button"
      data-nav="button"
      className={`${className} brand-inicio`}
      title="Ir al inicio"
      aria-label="CanalCasa — ir al inicio"
      onClick={onIr}
    >
      <span className="brand" aria-hidden="true">
        <Tv strokeWidth={1.5} />
      </span>
      {/* En dos líneas. En una sola no cabía junto a siete destinos y se
          truncaba a "CanalC…"; partido por la mitad entra entero y
          además ocupa menos ancho, que es lo que la barra necesita. */}
      <span className="marca" aria-hidden="true">
        <span>Canal</span>
        <span>Casa</span>
      </span>
    </button>
  );
}

export function TopNav({ view, onNavigate }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);

  // El reloj lo lleva la barra y no quien la usa: es parte del chrome, y así
  // funciona igual dentro y fuera del shell sin que nadie se lo tenga que pasar.
  const clock = useReloj();

  const irA = (destino: ViewId) => {
    setMasAbierto(false);
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
          onClick={() => setMasAbierto(false)}
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
        <MarcaInicio className="profile-cluster" onIr={() => irA("home")} />

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
        <MarcaInicio className="mobile-brand" onIr={() => irA("home")} />
        <span className="top-clock">{clock}</span>
      </header>

      {/* …y destinos abajo, donde llega el pulgar.

          Cinco a la vista y el resto detrás de «Más»: los ocho en 393px dejan
          cada casilla en 49px con la etiqueta partida, y aquí las etiquetas no
          sobran — esta app la usa gente que reconoce la palabra antes que el
          icono. */}
      {masAbierto && (
        <>
          {/* Tocar fuera cierra. Es un `<button>` y no un `<div>` para que
              también se pueda cerrar desde un teclado o un mando. */}
          <button
            type="button"
            className="mobile-mas-fondo"
            aria-label="Cerrar más secciones"
            onClick={() => setMasAbierto(false)}
          />
          <div className="mobile-mas" role="group" aria-label="Más secciones">
            {NAV_ITEMS.filter((item) => MOBILE_OVERFLOW_KEYS.includes(item.key)).map((item) =>
              renderItem(item, "mobile-mas-item"),
            )}
          </div>
        </>
      )}

      <nav className="mobile-bottom-nav" aria-label="Secciones" data-nav-chrome>
        {NAV_ITEMS.filter((item) => MOBILE_PRIMARY_KEYS.includes(item.key)).map((item) =>
          renderItem(item, "mobile-nav-item"),
        )}
        <button
          type="button"
          data-nav="button"
          className={`mobile-nav-item ${masAbierto ? "is-active" : ""}`}
          aria-expanded={masAbierto}
          aria-label={masAbierto ? "Cerrar más secciones" : "Más secciones"}
          onClick={() => setMasAbierto((abierto) => !abierto)}
        >
          {masAbierto ? <X aria-hidden="true" /> : <Ellipsis aria-hidden="true" />}
          <span>{masAbierto ? "Cerrar" : "Más"}</span>
        </button>
      </nav>
    </>
  );
}
