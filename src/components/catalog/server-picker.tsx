"use client";

import { useRef } from "react";
import { MonitorPlay } from "lucide-react";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import type { EmbedProvider } from "@/lib/catalog/providers";

/**
 * Selector de servidor, anclado al pie del reproductor.
 *
 * El cambio es manual, y no por elección estética: el reproductor va dentro de
 * un iframe de otro dominio, así que desde aquí **no se puede saber si cargó,
 * si falló o en qué idioma está**. Un "cambio automático al fallar" tendría que
 * adivinar, y adivinaría mal: el evento `load` se dispara igual cuando el
 * proveedor devuelve una página de error. Un botón visible es honesto y, con un
 * control remoto, más rápido que cualquier detección.
 *
 * Va pegado al vídeo y no flotando debajo porque es un control **de ese
 * reproductor**: cuando la imagen no se ve, la mano ya está ahí. Suelto en la
 * página parecía una sección más, y había que buscarlo.
 *
 * Se numeran ("Servidor 1", "Servidor 2") a propósito: quien está delante de la
 * tele no tiene por qué saber qué es VidSrc.
 */
/**
 * Identificador del servidor «Directo».
 *
 * No sale de `getProviders()` porque no es un proveedor de iframe: no tiene
 * plantilla de URL ni dominio. Es otra forma de reproducir —un archivo de
 * vídeo que se busca en el momento— y se añade al final de la lista para que
 * quien esté delante de la tele lo vea como un servidor más.
 */
export const ID_DIRECTO = "directo";

export function ServerPicker({
  providers,
  activeId,
  onSelect,
  /** Lo que se sabe del idioma; se muestra en la misma barra. */
  nota,
}: {
  providers: EmbedProvider[];
  activeId: string;
  onSelect: (id: string) => void;
  nota?: React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  useGridNavigation(listRef, "[data-server]");

  if (providers.length < 2) return null;

  const opciones = [...providers.map((p) => ({ id: p.id, label: p.label })), {
    id: ID_DIRECTO,
    label: "Directo",
  }];

  return (
    <div className="servidores">
      <p className="servidores-titulo">
        <MonitorPlay aria-hidden="true" />
        ¿No se ve o está en otro idioma?
      </p>

      <div ref={listRef} className="servidores-lista" role="group" aria-label="Servidor de vídeo">
        {opciones.map((opcion) => {
          const activo = opcion.id === activeId;
          return (
            <button
              key={opcion.id}
              type="button"
              data-server
              data-nav="button"
              aria-pressed={activo}
              onClick={() => onSelect(opcion.id)}
              className={`servidor ${activo ? "is-active" : ""} ${
                opcion.id === ID_DIRECTO ? "is-directo" : ""
              }`}
            >
              {opcion.label}
            </button>
          );
        })}
      </div>

      {nota && <div className="servidores-nota">{nota}</div>}
    </div>
  );
}
