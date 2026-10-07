"use client";

import { Check, Plus } from "lucide-react";
import { useWatchlist } from "@/hooks/use-watchlist";

/**
 * El «＋» del héroe: añade el título a «Mi lista» sin entrar en la ficha.
 *
 * Es de cliente porque «Mi lista» vive en este aparato (`use-watchlist.ts`):
 * el servidor no puede saber si ya está marcado. Por eso el héroe sigue siendo
 * de servidor y solo esta pieza se hidrata.
 *
 * Solo icono, pero con nombre: `aria-label` lo dice en voz alta y `title` lo
 * enseña al pasar el ratón. Cambia de ＋ a ✓, que es la marca que ya se
 * entiende en cualquier tienda de cine.
 */
export function BotonMiLista({ clave, titulo }: { clave: string; titulo: string }) {
  const { ids, toggle } = useWatchlist();
  const enLista = ids.has(clave);
  const texto = enLista ? `Quitar «${titulo}» de mi lista` : `Añadir «${titulo}» a mi lista`;

  return (
    <button
      type="button"
      data-nav="button"
      className={`hero-icono ${enLista ? "is-activo" : ""}`}
      onClick={() => toggle(clave)}
      aria-pressed={enLista}
      aria-label={texto}
      title={enLista ? "En mi lista" : "Añadir a mi lista"}
    >
      {enLista ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
    </button>
  );
}
