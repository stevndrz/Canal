"use client";

import { useSyncExternalStore } from "react";
import type { PlaybackSettings } from "@/lib/types";
import {
  TAMANOS_TEXTO,
  aplicarTamanoTexto,
  leerTamanoTexto,
  suscribirTamanoTexto,
  type TamanoTexto,
} from "@/lib/tamano-texto";

interface AjustesViewProps {
  settings: PlaybackSettings;
  onChange: (patch: Partial<PlaybackSettings>) => void;
  channelCount: number;
  favoriteCount: number;
  onClearFavorites: () => void;
  onRefresh: () => void;
  m3uSource: string;
}

const ENGINE_LABELS: Record<PlaybackSettings["engine"], string> = {
  auto: "Automático",
  hls: "Forzar HLS.js",
  mpegts: "Forzar mpegts.js",
};

const CALIDADES: PlaybackSettings["calidad"][] = ["auto", "480p", "720p", "1080p"];

const CALIDAD_LABELS: Record<PlaybackSettings["calidad"], string> = {
  auto: "Automática",
  "480p": "480p",
  "720p": "720p",
  "1080p": "1080p",
};

const TAMANO_LABELS: Record<TamanoTexto, string> = {
  normal: "Normal",
  grande: "Grande",
  enorme: "Muy grande",
};

/**
 * Tres botones y no un deslizador: con el mando un deslizador pide aprender
 * un gesto, y tres opciones con nombre se entienden de un vistazo. Cada letra
 * «A» va en el tamaño que promete, así se elige mirando y no leyendo.
 */
function SelectorTamanoTexto() {
  // "normal" en el servidor; el valor real vive en `localStorage`, que solo
  // existe en el navegador.
  const tamano = useSyncExternalStore(suscribirTamanoTexto, leerTamanoTexto, () => "normal");

  return (
    <div role="group" aria-label="Tamaño del texto" className="flex flex-wrap gap-2">
      {TAMANOS_TEXTO.map((opcion, i) => {
        const activa = opcion === tamano;
        return (
          <button
            key={opcion}
            type="button"
            data-nav="button"
            aria-pressed={activa}
            onClick={() => aplicarTamanoTexto(opcion)}
            className={`inline-flex min-h-[48px] items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors ${
              activa
                ? "border-transparent bg-accent text-accent-on"
                : "border-white/10 bg-white/[0.06] hover:bg-white/[0.13]"
            }`}
          >
            <span aria-hidden="true" className="font-semibold" style={{ fontSize: `${1 + i * 0.25}em` }}>
              A
            </span>
            {TAMANO_LABELS[opcion]}
          </button>
        );
      })}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    /* En teléfono la fila se apila. En una sola línea, la etiqueta, la pista y
       el control no caben en 390px: el control quedaba aplastado contra el
       borde y la pista se cortaba a media palabra. La pista además deja de
       truncarse al apilarse, porque ahí sí hay sitio para leerla entera. */
    <div className="flex min-h-[76px] flex-col items-start gap-3 border-b border-white/[0.06] px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-4.5">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium">{label}</p>
        <p className="mt-1 text-xs text-soft sm:truncate">{hint}</p>
      </div>
      <div className="flex w-full shrink-0 justify-start sm:w-auto sm:justify-end">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      data-nav="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-11 w-[58px] shrink-0 rounded-full border border-white/12 ${
        checked ? "bg-accent" : "bg-white/[0.08]"
      }`}
    >
      <span
        className={`absolute top-[3px] h-[26px] w-[26px] rounded-full transition-[left] duration-200 ${
          checked ? "left-[27px] bg-accent-on" : "left-[3px] bg-soft"
        }`}
      />
    </button>
  );
}

export function AjustesView({
  settings,
  onChange,
  channelCount,
  favoriteCount,
  onClearFavorites,
  onRefresh,
  m3uSource,
}: AjustesViewProps) {
  const buttonClass =
    "inline-flex min-h-[44px] shrink-0 items-center rounded-2xl border border-white/10 bg-white/[0.06] px-4.5 text-sm font-medium hover:bg-white/[0.13]";

  const engines: PlaybackSettings["engine"][] = ["auto", "hls", "mpegts"];

  return (
    /* Encabezado y contenido con el mismo lenguaje que el resto de secciones, y
       centrados: a 1920px la columna quedaba pegada a la izquierda con medio
       televisor vacío al lado. */
    <div className="ajustes">
      <section className="section-heading library-heading">
        <div className="library-title-block">
          <p className="eyebrow">Sin cuenta ni base de datos: todo vive en este dispositivo</p>
          <h2>Ajustes</h2>
        </div>
      </section>

      {/* Ordenado por quién lo usa, no por cómo funciona: arriba lo que
          cualquiera entiende (ver más grande, la calidad, el sonido), abajo lo
          técnico. Antes la primera sección era «Fuente · M3U_URL» y la segunda
          hablaba de HLS.js y workers: lo primero que leía un abuelo o un niño
          era jerga. */}
      <div className="ajustes-columna">
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-soft">Pantalla</h2>
          <div className="overflow-hidden rounded-[18px] border border-hairline">
            <Row label="Tamaño del texto" hint="Agranda las letras de toda la app en este aparato">
              <SelectorTamanoTexto />
            </Row>
            <Row label="Botones grandes" hint="Botones más grandes y con nombre en el reproductor">
              <Toggle
                checked={settings.bigControls}
                label="Botones grandes"
                onChange={() => onChange({ bigControls: !settings.bigControls })}
              />
            </Row>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-soft">Reproducción</h2>
          <div className="overflow-hidden rounded-[18px] border border-hairline">
            <Row label="Calidad" hint="Automática se adapta a tu internet; fija limita la resolución">
              <button
                type="button"
                data-nav="button"
                onClick={() => {
                  const next = CALIDADES[(CALIDADES.indexOf(settings.calidad ?? "auto") + 1) % CALIDADES.length];
                  // Se escriben los dos: el motor resuelve el viejo para los
                  // aparatos que aún lo guardan (ver `resolverCalidad`).
                  onChange({ calidad: next, calidadMaxima: next !== "auto" });
                }}
                className={buttonClass}
              >
                {CALIDAD_LABELS[settings.calidad ?? "auto"]}
              </button>
            </Row>
            <Row label="Imagen" hint="Completa enseña todo el cuadro; llenar recorta los bordes">
              <button
                type="button"
                data-nav="button"
                className={buttonClass}
                onClick={() =>
                  onChange({
                    ajusteImagen: settings.ajusteImagen === "contener" ? "llenar" : "contener",
                  })
                }
              >
                {settings.ajusteImagen === "contener" ? "Completa" : "Llenar"}
              </button>
            </Row>
            <Row label="Empezar con sonido" hint="Si el navegador no lo deja, te pedirá un toque">
              <Toggle
                checked={settings.startUnmuted}
                label="Empezar con sonido"
                onChange={() => onChange({ startUnmuted: !settings.startUnmuted })}
              />
            </Row>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-soft">Canales</h2>
          <div className="overflow-hidden rounded-[18px] border border-hairline">
            <Row label="Actualizar canales" hint={`Vuelve a cargar la lista · ${channelCount} canales`}>
              <button type="button" data-nav="button" onClick={onRefresh} className={buttonClass}>
                Actualizar
              </button>
            </Row>
            <Row label="Favoritos" hint={`${favoriteCount} guardados en este aparato`}>
              <button
                type="button"
                data-nav="button"
                onClick={onClearFavorites}
                className={buttonClass}
              >
                Borrar todos
              </button>
            </Row>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-soft">Avanzado</h2>
          <div className="overflow-hidden rounded-[18px] border border-hairline">
            <Row label="Lista de canales (M3U)" hint={m3uSource}>
              <span className="shrink-0 text-sm text-soft">M3U_URL</span>
            </Row>
            <Row label="Motor de vídeo" hint="HLS.js para .m3u8 · mpegts.js para .ts y .flv">
              <button
                type="button"
                data-nav="button"
                onClick={() => {
                  const next = engines[(engines.indexOf(settings.engine) + 1) % engines.length];
                  onChange({ engine: next });
                }}
                className={buttonClass}
              >
                {ENGINE_LABELS[settings.engine]}
              </button>
            </Row>
            <Row label="Menos retraso" hint="Más cerca del directo; en internet lento se corta más">
              <Toggle
                checked={settings.lowLatencyMode}
                label="Menos retraso"
                onChange={() => onChange({ lowLatencyMode: !settings.lowLatencyMode })}
              />
            </Row>
            <Row label="Alcanzar el directo" hint="Si la imagen se queda atrás, salta al momento actual">
              <Toggle
                checked={settings.liveBufferLatencyChasing}
                label="Alcanzar el directo"
                onChange={() =>
                  onChange({ liveBufferLatencyChasing: !settings.liveBufferLatencyChasing })
                }
              />
            </Row>
            <Row label="Vídeo en segundo plano" hint="Reparte el trabajo; evita tirones en televisores Samsung">
              <Toggle
                checked={settings.enableWorker}
                label="Vídeo en segundo plano"
                onChange={() => onChange({ enableWorker: !settings.enableWorker })}
              />
            </Row>
          </div>
        </section>
      </div>
    </div>
  );
}
