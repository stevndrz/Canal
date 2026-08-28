"use client";

import type { PlaybackSettings } from "@/lib/types";

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
        <p className="mt-1 text-[13px] text-soft sm:truncate">{hint}</p>
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

      <div className="ajustes-columna">
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-soft">Fuente</h2>
          <div className="overflow-hidden rounded-[18px] border border-hairline">
            <Row label="Lista M3U" hint={m3uSource}>
              <span className="shrink-0 text-sm text-soft">M3U_URL</span>
            </Row>
            <Row
              label="Actualizar ahora"
              hint={`Caché de 30 s · ${channelCount} canales detectados`}
            >
              <button type="button" data-nav="button" onClick={onRefresh} className={buttonClass}>
                Actualizar
              </button>
            </Row>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-soft">Reproducción</h2>
          <div className="overflow-hidden rounded-[18px] border border-hairline">
            <Row label="Motor de video" hint="HLS.js para .m3u8 · mpegts.js para .ts y .flv">
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
            <Row label="Baja latencia" hint="lowLatencyMode en HLS.js">
              <Toggle
                checked={settings.lowLatencyMode}
                label="Baja latencia"
                onChange={() => onChange({ lowLatencyMode: !settings.lowLatencyMode })}
              />
            </Row>
            <Row label="Decodificar en worker" hint="enableWorker · evita tirones en Tizen">
              <Toggle
                checked={settings.enableWorker}
                label="Decodificar en worker"
                onChange={() => onChange({ enableWorker: !settings.enableWorker })}
              />
            </Row>
            <Row label="Perseguir el vivo" hint="liveBufferLatencyChasing en mpegts.js">
              <Toggle
                checked={settings.liveBufferLatencyChasing}
                label="Perseguir el vivo"
                onChange={() =>
                  onChange({ liveBufferLatencyChasing: !settings.liveBufferLatencyChasing })
                }
              />
            </Row>
            <Row
              label="Calidad máxima"
              hint="Arranca en la mejor pista en vez de subir poco a poco. Para fibra"
            >
              <Toggle
                checked={settings.calidadMaxima}
                label="Calidad máxima"
                onChange={() => onChange({ calidadMaxima: !settings.calidadMaxima })}
              />
            </Row>

            <Row
              label="Ajuste de imagen"
              hint="Contener respeta la imagen entera; llenar recorta para ocupar el marco"
            >
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
                {settings.ajusteImagen === "contener" ? "Contener" : "Llenar"}
              </button>
            </Row>

            <Row
              label="Controles grandes"
              hint="Botones más altos y con todas las palabras a la vista"
            >
              <Toggle
                checked={settings.bigControls}
                label="Controles grandes"
                onChange={() => onChange({ bigControls: !settings.bigControls })}
              />
            </Row>

            <Row label="Arrancar con sonido" hint="Si el navegador lo bloquea, pide un OK">
              <Toggle
                checked={settings.startUnmuted}
                label="Arrancar con sonido"
                onChange={() => onChange({ startUnmuted: !settings.startUnmuted })}
              />
            </Row>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-soft">
            Este dispositivo
          </h2>
          <div className="overflow-hidden rounded-[18px] border border-hairline">
            <Row
              label="Favoritos guardados"
              hint={`${favoriteCount} canales · canalcasa:favorites`}
            >
              <button
                type="button"
                data-nav="button"
                onClick={onClearFavorites}
                className={buttonClass}
              >
                Borrar
              </button>
            </Row>
          </div>
        </section>
      </div>
    </div>
  );
}
