"use client";

import { CalendarClock, ChevronRight, List, Search, Star, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { TEMAS_CON_CHIP, TEMAS_DE_MAS, type Tema } from "@/lib/temas";
import { cifra, type Filtro } from "@/lib/secciones-canales";

/**
 * La cabecera de Canales: el título, el buscador y los chips de TEMA.
 *
 * Los chips eran categorías que mezclaban país, idioma y tema («Guatemala»,
 * «Inglés», «Internacional»), y el país ya no hace falta elegirlo: el cuerpo
 * de la lista va por secciones de lo cercano a lo lejano. Aquí solo se elige
 * de qué va lo que se quiere ver, y el chip filtra todas las secciones a la
 * vez.
 *
 * Nada de esto se guarda: la categoría elegida en la pantalla vieja se colaba
 * en Buscar y en el zapeo de toda la app. Este estado vive y muere aquí.
 */
export function BarraFiltros({
  total,
  filtro,
  onFiltro,
  masAbierto,
  onMas,
  busqueda,
  onBusqueda,
  onBuscarEnTv,
  ofrecerParrilla,
  modo,
  onModo,
}: {
  total: number;
  filtro: Filtro;
  onFiltro: (filtro: Filtro) => void;
  masAbierto: boolean;
  onMas: () => void;
  busqueda: string;
  onBusqueda: (texto: string) => void;
  /** En la tele no hay teclado: la lupa lleva a Buscar, que trae el suyo. */
  onBuscarEnTv: () => void;
  ofrecerParrilla: boolean;
  modo: "lista" | "parrilla";
  onModo: (modo: "lista" | "parrilla") => void;
}) {
  const tira = useRef<HTMLDivElement | null>(null);

  // El chip activo siempre a la vista: en un teléfono caben dos o tres de
  // once, y uno elegido fuera de la pantalla no dice qué se está viendo.
  useEffect(() => {
    const activo = tira.current?.querySelector<HTMLElement>(".livetv-chip.is-active");
    const caja = tira.current;
    if (!activo || !caja) return;
    const izquierda = activo.offsetLeft - caja.offsetLeft;
    if (izquierda < caja.scrollLeft || izquierda + activo.offsetWidth > caja.scrollLeft + caja.clientWidth) {
      caja.scrollTo({ left: Math.max(0, izquierda - 24) });
    }
  }, [filtro, masAbierto]);

  /**
   * Un campo de texto se queda con las flechas: `use-spatial-nav` las ignora
   * dentro de un `<input>` para no robarle el cursor. Con ↓ en el campo de
   * Canales se bajaba a… nada, y el mando quedaba atrapado. Aquí ↓ va a los
   * chips y ↑ a la barra, que es lo que se espera desde el borde de un campo.
   */
  const salirDelCampo = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "ArrowDown") {
      const chip = tira.current?.querySelector<HTMLElement>(".livetv-chip.is-active");
      if (chip) {
        evento.preventDefault();
        chip.focus();
      }
    } else if (evento.key === "ArrowUp") {
      const actual = document.querySelector<HTMLElement>('[data-nav-chrome] [aria-current="page"]');
      if (actual && actual.offsetParent !== null) {
        evento.preventDefault();
        actual.focus();
      }
    }
  };

  const chip = (valor: Filtro, etiqueta: string, extra?: ReactNode) => (
    <button
      key={valor}
      type="button"
      data-nav="button"
      className={`livetv-chip ${filtro === valor ? "is-active" : ""}`}
      aria-pressed={filtro === valor}
      onClick={() => onFiltro(valor)}
    >
      {extra}
      <span>{etiqueta}</span>
    </button>
  );

  // «Más» se marca si lo elegido está detrás de él y no se ve: así nunca hay
  // un filtro puesto sin un chip encendido que lo diga.
  const masActivo = filtro === "mas" || (TEMAS_DE_MAS as readonly string[]).includes(filtro);

  return (
    <header className="livetv-cabecera">
      <div className="livetv-topbar">
        <div className="livetv-heading">
          <h2>Canales</h2>
          <span>{cifra(total)} canales</span>
        </div>

        <div className="livetv-search">
          <Search aria-hidden="true" />
          <input
            data-nav="input"
            type="search"
            enterKeyHint="search"
            value={busqueda}
            onChange={(evento) => onBusqueda(evento.target.value)}
            onKeyDown={salirDelCampo}
            placeholder="Buscar canal, país o tema"
            aria-label="Buscar canal, país o tema"
          />
          {busqueda && (
            <button type="button" data-nav="button" onClick={() => onBusqueda("")} aria-label="Borrar búsqueda">
              <X aria-hidden="true" />
            </button>
          )}
        </div>

        {/* En la tele el campo no se ve (CSS): con un mando no se escribe en
            un campo, se escribe en el teclado de Buscar. */}
        <button type="button" data-nav="button" className="livetv-lupa" onClick={onBuscarEnTv}>
          <Search aria-hidden="true" />
          <span>Buscar</span>
        </button>

        {ofrecerParrilla && (
          <div className="livetv-modo" role="group" aria-label="Cómo ver la lista">
            <button
              type="button"
              data-nav="button"
              onClick={() => onModo("lista")}
              aria-pressed={modo === "lista"}
              className={modo === "lista" ? "is-active" : ""}
            >
              <List aria-hidden="true" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              data-nav="button"
              onClick={() => onModo("parrilla")}
              aria-pressed={modo === "parrilla"}
              className={modo === "parrilla" ? "is-active" : ""}
            >
              <CalendarClock aria-hidden="true" />
              <span>Parrilla</span>
            </button>
          </div>
        )}
      </div>

      <div className="livetv-chips-marco">
        <nav className="livetv-chips" aria-label="Temas" ref={tira}>
          {chip("mios", "Mis canales", <Star aria-hidden="true" />)}
          {chip("todo", "Todo")}
          {TEMAS_CON_CHIP.map((tema) => chip(tema, tema))}
          <button
            type="button"
            data-nav="button"
            className={`livetv-chip ${masActivo && !masAbierto ? "is-active" : ""} ${masAbierto ? "is-abierto" : ""}`}
            aria-expanded={masAbierto}
            onClick={onMas}
          >
            <span>{masAbierto ? "Menos" : "Más"}</span>
            <ChevronRight aria-hidden="true" />
          </button>
          {masAbierto && (TEMAS_DE_MAS as readonly Tema[]).map((tema) => chip(tema, tema))}
        </nav>
      </div>
    </header>
  );
}
