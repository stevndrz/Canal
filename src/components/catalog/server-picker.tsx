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

  return (
    <div className="servidores">
      <p className="servidores-titulo">
        <MonitorPlay aria-hidden="true" />
        ¿No se ve o está en otro idioma?
      </p>

      <div ref={listRef} className="servidores-lista" role="group" aria-label="Servidor de vídeo">
        {providers.map((provider) => {
          const activo = provider.id === activeId;
          return (
            <button
              key={provider.id}
              type="button"
              data-server
              data-nav="button"
              aria-pressed={activo}
              onClick={() => onSelect(provider.id)}
              className={`servidor ${activo ? "is-active" : ""}`}
            >
              {provider.label}
            </button>
          );
        })}
      </div>

      {nota && <div className="servidores-nota">{nota}</div>}
    </div>
  );
}
