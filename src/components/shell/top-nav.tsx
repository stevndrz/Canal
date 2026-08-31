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
 * La barra de navegación, en sus tres formas: fija arriba en escritorio y TV,
 * cabecera y barra inferior en teléfono.
 *
 * Las tres llevan `data-nav-chrome` porque son fijas y están siempre pegadas al
 * borde: sin marcarlas ganaban cualquier movimiento vertical del mando y el
 * foco no podía volver al riel de encima.
 *
 * Cuidado con `.sidebar`: pese al nombre es una barra SUPERIOR, no una columna
 * lateral. Los nombres de clase son el contrato con `shell.css` y por eso no se
 * tocan.
 */

function isActive(item: NavItem, view: ViewId | undefined, pathname: string): boolean {
  if (item.kind === "link") return pathname.startsWith(item.href);
  // En una ruta de fuera del shell ninguna vista está activa: manda el enlace.
  if (view === undefined) return false;
  return view === item.key || (item.key === "canales" && view === "player");
}

/**
 * Los cuatro repartos de `NAV_ITEMS`, resueltos una vez al cargar el módulo.
 *
 * Dos de ellos se calculaban dentro del render, así que se rehacían en cada
 * pulsación de la barra para dar siempre lo mismo. Ajustes va aparte porque
 * vive en el engranaje de la derecha, no entre los destinos.
 */
const AJUSTES = NAV_ITEMS.find((item) => item.key === "ajustes");
const DESTINOS = NAV_ITEMS.filter((item) => item.key !== "ajustes");
const MOVIL_PRINCIPALES = NAV_ITEMS.filter((item) => MOBILE_PRIMARY_KEYS.includes(item.key));
const MOVIL_RESTO = NAV_ITEMS.filter((item) => MOBILE_OVERFLOW_KEYS.includes(item.key));

/**
 * La marca es también un botón al inicio, como se espera del logo de cualquier
 * app. La usan las dos barras, heredando el aspecto de la clase de cada una.
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

export function TopNav({
  view,
  onNavigate,
}: {
  /**
   * Vista activa del shell. Opcional porque la barra también se pinta fuera de
   * él —en `/peliculas`—, donde la sección activa la decide la URL. Antes esas
   * rutas no tenían barra y cambiar de sección se sentía como salir de la app.
   */
  view?: ViewId;
  /** Sin ella la barra navega a `/?vista=…`, que es lo que necesitan las rutas de fuera. */
  onNavigate?: (view: ViewId) => void;
}) {
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
            {MOVIL_RESTO.map((item) => renderItem(item, "mobile-mas-item"))}
          </div>
        </>
      )}

      <nav className="mobile-bottom-nav" aria-label="Secciones" data-nav-chrome>
        {MOVIL_PRINCIPALES.map((item) => renderItem(item, "mobile-nav-item"))}
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
