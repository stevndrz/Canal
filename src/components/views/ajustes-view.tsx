"use client";

import { useId, useSyncExternalStore, type ReactNode } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import type { PlaybackSettings } from "@/lib/types";
import {
  TAMANOS_TEXTO,
  aplicarTamanoTexto,
  leerTamanoTexto,
  suscribirTamanoTexto,
  type TamanoTexto,
} from "@/lib/tamano-texto";
import {
  Boton,
  Confirmacion,
  ContenedorVista,
  EncabezadoSeccion,
  Interruptor,
  Segmentado,
  type OpcionSegmentado,
} from "@/components/ui";
import { contarCosas } from "@/components/ui/teclas";

interface AjustesViewProps {
  settings: PlaybackSettings;
  onChange: (patch: Partial<PlaybackSettings>) => void;
  channelCount: number;
  favoriteCount: number;
  onClearFavorites: () => void;
  onRefresh: () => void;
  m3uSource: string;
}

const MOTORES: OpcionSegmentado<PlaybackSettings["engine"]>[] = [
  { valor: "auto", etiqueta: "Automático" },
  { valor: "hls", etiqueta: "HLS.js" },
  { valor: "mpegts", etiqueta: "mpegts.js" },
];

const CALIDADES: OpcionSegmentado<PlaybackSettings["calidad"]>[] = [
  { valor: "auto", etiqueta: "Automática" },
  { valor: "480p", etiqueta: "480p" },
  { valor: "720p", etiqueta: "720p" },
  { valor: "1080p", etiqueta: "1080p" },
];

const IMAGENES: OpcionSegmentado<PlaybackSettings["ajusteImagen"]>[] = [
  { valor: "contener", etiqueta: "Completa" },
  { valor: "llenar", etiqueta: "Llenar" },
];

const TAMANO_LABELS: Record<TamanoTexto, string> = {
  normal: "Normal",
  grande: "Grande",
  enorme: "Muy grande",
};

/**
 * Tres opciones y no un deslizador: con el mando un deslizador pide aprender
 * un gesto, y tres opciones con nombre se entienden de un vistazo. Cada «A»
 * va en el tamaño que promete, así se elige mirando y no leyendo.
 *
 * Elegir es OK, no pasar por encima (ver `Segmentado`): con las flechas no
 * se agranda la app a mitad de camino hacia otra opción.
 */
function SelectorTamanoTexto({ idEtiqueta }: { idEtiqueta: string }) {
  // "normal" en el servidor; el valor real vive en `localStorage`, que solo
  // existe en el navegador.
  const tamano = useSyncExternalStore(suscribirTamanoTexto, leerTamanoTexto, () => "normal" as const);

  const opciones = TAMANOS_TEXTO.map((opcion, i) => ({
    valor: opcion,
    nombre: TAMANO_LABELS[opcion],
    etiqueta: (
      <>
        <span aria-hidden="true" className="ajustes-letra" style={{ fontSize: `${1 + i * 0.25}em` }}>
          A
        </span>
        {TAMANO_LABELS[opcion]}
      </>
    ),
  }));

  return (
    <Segmentado
      aria-labelledby={idEtiqueta}
      opciones={opciones}
      valor={tamano}
      onCambio={aplicarTamanoTexto}
    />
  );
}

/**
 * Una fila de ajuste: qué es, para qué sirve y el control.
 *
 * Sin puntos de corte: el texto pide como mínimo 16em y el control lo que
 * mida. Si caben, van en una línea (el interruptor a la derecha, como en el
 * iPhone); si no, el control baja debajo del texto. Así funciona igual en
 * 320 px, en un PC y con «Muy grande», que es justo cuando no cabe.
 *
 * El nombre de la fila es la etiqueta del control (`aria-labelledby`): el
 * lector dice «Botones grandes, interruptor, desactivado» y no solo
 * «interruptor».
 */
function Fila({
  etiqueta,
  pista,
  ancho,
  children,
}: {
  etiqueta: string;
  pista: ReactNode;
  /** El control ocupa toda la línea (segmentados largos). */
  ancho?: boolean;
  children: (idEtiqueta: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={`ajustes-fila ${ancho ? "is-ancho" : ""}`}>
      <div className="ajustes-fila-texto">
        <p id={id} className="ajustes-fila-nombre">
          {etiqueta}
        </p>
        <p className="ajustes-fila-pista">{pista}</p>
      </div>
      <div className="ajustes-fila-control">{children(id)}</div>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="ajustes-grupo" aria-labelledby={id}>
      <EncabezadoSeccion talla="grupo" titulo={titulo} idTitulo={id} />
      <div className="ajustes-lista">{children}</div>
    </section>
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
  return (
    /* El margen lo pone `ContenedorVista` a todos los anchos: antes solo se
       ponía en el teléfono y, entre 681 y 880 px, el texto tocaba los bordes. */
    <ContenedorVista ancho="lectura" className="ajustes">
      <EncabezadoSeccion
        talla="pagina"
        sobretitulo="Sin cuenta ni base de datos: todo vive en este dispositivo"
        titulo="Ajustes"
      />

      {/* Ordenado por quién lo usa, no por cómo funciona: arriba lo que
          cualquiera entiende (ver más grande, la calidad, el sonido), abajo lo
          técnico. */}
      <div className="ajustes-columna">
        <Grupo titulo="Pantalla">
          <Fila etiqueta="Tamaño del texto" pista="Agranda las letras de toda la app en este aparato" ancho>
            {(id) => <SelectorTamanoTexto idEtiqueta={id} />}
          </Fila>
          <Fila etiqueta="Botones grandes" pista="Botones más grandes y con nombre en el reproductor">
            {(id) => (
              <Interruptor
                aria-labelledby={id}
                activo={settings.bigControls}
                onCambio={(bigControls) => onChange({ bigControls })}
              />
            )}
          </Fila>
        </Grupo>

        <Grupo titulo="Reproducción">
          <Fila etiqueta="Calidad" pista="Automática se adapta a tu internet; fija limita la resolución" ancho>
            {(id) => (
              <Segmentado
                aria-labelledby={id}
                opciones={CALIDADES}
                valor={settings.calidad ?? "auto"}
                // Se escriben los dos: el motor resuelve el viejo para los
                // aparatos que aún lo guardan (ver `resolverCalidad`).
                onCambio={(calidad) => onChange({ calidad, calidadMaxima: calidad !== "auto" })}
              />
            )}
          </Fila>
          <Fila etiqueta="Imagen" pista="Completa enseña todo el cuadro; llenar recorta los bordes">
            {(id) => (
              <Segmentado
                aria-labelledby={id}
                opciones={IMAGENES}
                valor={settings.ajusteImagen}
                onCambio={(ajusteImagen) => onChange({ ajusteImagen })}
              />
            )}
          </Fila>
          <Fila etiqueta="Empezar con sonido" pista="Si el navegador no lo deja, te pedirá permiso">
            {(id) => (
              <Interruptor
                aria-labelledby={id}
                activo={settings.startUnmuted}
                onCambio={(startUnmuted) => onChange({ startUnmuted })}
              />
            )}
          </Fila>
        </Grupo>

        <Grupo titulo="Canales">
          <Fila
            etiqueta="Actualizar canales"
            pista={`Vuelve a cargar la lista · ${contarCosas(channelCount, "canal", "canales")}`}
          >
            {() => (
              <Boton icono={<RefreshCw />} onClick={onRefresh}>
                Actualizar
              </Boton>
            )}
          </Fila>
          <Fila
            etiqueta="Favoritos"
            pista={`${contarCosas(favoriteCount, "guardado", "guardados")} en este aparato`}
          >
            {/* Dos pasos: el primer OK pregunta y deja el foco en «No». Antes
                una sola pulsación —la más fácil de repetir sin querer con el
                mando— borraba todos sin aviso ni forma de deshacer. */}
            {() => (
              <Confirmacion
                icono={<Trash2 />}
                pregunta={`¿Borrar ${contarCosas(favoriteCount, "favorito", "favoritos")}?`}
                onConfirmar={onClearFavorites}
                disabled={favoriteCount === 0}
              >
                Borrar todos
              </Confirmacion>
            )}
          </Fila>
        </Grupo>

        <Grupo titulo="Avanzado">
          <Fila etiqueta="Lista de canales (M3U)" pista={m3uSource}>
            {() => <span className="ajustes-dato">M3U_URL</span>}
          </Fila>
          <Fila etiqueta="Motor de vídeo" pista="HLS.js para .m3u8 · mpegts.js para .ts y .flv" ancho>
            {(id) => (
              <Segmentado
                aria-labelledby={id}
                opciones={MOTORES}
                valor={settings.engine}
                onCambio={(engine) => onChange({ engine })}
              />
            )}
          </Fila>
          <Fila etiqueta="Menos retraso" pista="Más cerca del directo; en internet lento se corta más">
            {(id) => (
              <Interruptor
                aria-labelledby={id}
                activo={settings.lowLatencyMode}
                onCambio={(lowLatencyMode) => onChange({ lowLatencyMode })}
              />
            )}
          </Fila>
          <Fila etiqueta="Alcanzar el directo" pista="Si la imagen se queda atrás, salta al momento actual">
            {(id) => (
              <Interruptor
                aria-labelledby={id}
                activo={settings.liveBufferLatencyChasing}
                onCambio={(liveBufferLatencyChasing) => onChange({ liveBufferLatencyChasing })}
              />
            )}
          </Fila>
          <Fila etiqueta="Vídeo en segundo plano" pista="Reparte el trabajo; evita tirones en televisores Samsung">
            {(id) => (
              <Interruptor
                aria-labelledby={id}
                activo={settings.enableWorker}
                onCambio={(enableWorker) => onChange({ enableWorker })}
              />
            )}
          </Fila>
        </Grupo>
      </div>
    </ContenedorVista>
  );
}
