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
    <div className="flex min-h-[76px] items-center gap-5 border-b border-white/[0.06] px-5 py-4.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium">{label}</p>
        <p className="mt-1 truncate text-[13px] text-zinc-500">{hint}</p>
      </div>
      {children}
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
          checked ? "left-[27px] bg-accent-on" : "left-[3px] bg-zinc-400"
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
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] xl:text-[34px]">Ajustes</h1>
      <p className="mt-2.5 mb-7 text-[15px] text-zinc-500">
        Sin cuenta ni base de datos: todo vive en este dispositivo
      </p>

      <div className="flex max-w-[760px] flex-col gap-8">
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-zinc-600">Fuente</h2>
          <div className="overflow-hidden rounded-[18px] border border-hairline">
            <Row label="Lista M3U" hint={m3uSource}>
              <span className="shrink-0 text-sm text-zinc-500">M3U_URL</span>
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
          <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-zinc-600">Reproducción</h2>
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
          <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-zinc-600">
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
    </>
  );
}
