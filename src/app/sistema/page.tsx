"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowRight, Heart, Inbox, Play, Plus, Settings, Star, Trash2, X } from "lucide-react";
import {
  Aviso,
  Boton,
  BotonIcono,
  Campo,
  CampoBusqueda,
  Chip,
  Confirmacion,
  ContenedorVista,
  EncabezadoSeccion,
  EstadoVacio,
  Interruptor,
  Segmentado,
  type VarianteBoton,
} from "@/components/ui";
import {
  TAMANOS_TEXTO,
  aplicarTamanoTexto,
  leerTamanoTexto,
  suscribirTamanoTexto,
} from "@/lib/tamano-texto";
import { esTelevisorUA } from "@/lib/dispositivo";

/**
 * `/sistema`: el sistema de diseño de un vistazo.
 *
 * Todas las primitivas de `src/components/ui`, en todas sus variantes y en
 * los cinco estados (reposo, hover, foco, pulsado, deshabilitado), pintadas
 * por la propia app con su CSS de verdad: si algo cambia en `ui.css` o en
 * los tokens, aquí se ve al recargar. No hay enlace desde la navegación: es
 * una página de trabajo, no un destino.
 *
 * Los estados que dependen de la mano (hover, foco) se fuerzan con
 * `data-estado`, que `ui.css` atiende solo para esto.
 */

const VARIANTES: VarianteBoton[] = ["primario", "secundario", "fantasma", "peligro"];
const ESTADOS = ["reposo", "hover", "foco", "activo", "deshabilitado"] as const;
type Estado = (typeof ESTADOS)[number];

function propsDeEstado(estado: Estado) {
  if (estado === "deshabilitado") return { disabled: true };
  if (estado === "reposo") return {};
  return { "data-estado": estado };
}

/** Marca con `data-estado` piezas internas que no reciben props (un segmento, la píldora del campo). */
function Forzar({ estado, selector, children }: { estado: string; selector: string; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    caja.current?.querySelectorAll(selector).forEach((el) => el.setAttribute("data-estado", estado));
  });
  return (
    <div ref={caja} className="contents">
      {children}
    </div>
  );
}

function Muestra({ nombre, children, ancho }: { nombre: string; children: ReactNode; ancho?: boolean }) {
  return (
    <figure className={`m-0 flex min-w-0 flex-col items-start gap-3 ${ancho ? "col-span-full" : ""}`}>
      <div className={`flex min-h-[64px] max-w-full flex-wrap items-center gap-3 p-2 ${ancho ? "w-full" : ""}`}>{children}</div>
      <figcaption className="text-xs text-tinta-3">{nombre}</figcaption>
    </figure>
  );
}

function Bloque({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <section className="mt-12 border-t border-borde pt-8">
      <EncabezadoSeccion talla="seccion" titulo={titulo} descripcion={descripcion} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-x-6 gap-y-8">{children}</div>
    </section>
  );
}

const COLORES = [
  ["--fondo", "Fondo"],
  ["--superficie-1", "Superficie 1"],
  ["--superficie-2", "Superficie 2"],
  ["--superficie-3", "Superficie 3"],
  ["--relleno", "Relleno"],
  ["--relleno-hover", "Relleno hover"],
  ["--borde", "Borde"],
  ["--tinta-1", "Tinta 1"],
  ["--tinta-2", "Tinta 2"],
  ["--tinta-3", "Tinta 3"],
  ["--tinta-4", "Tinta 4 (no texto)"],
  ["--acento", "Acento"],
  ["--acento-texto", "Acento texto"],
  ["--vivo", "Vivo"],
  ["--peligro", "Peligro"],
  ["--exito", "Éxito"],
  ["--aviso", "Aviso"],
  ["--info", "Info"],
  ["--foco", "Foco"],
] as const;

const TEXTOS = ["3xl", "2xl", "xl", "lg", "base", "sm", "xs", "2xs"] as const;

const CALIDADES = [
  { valor: "auto", etiqueta: "Automática" },
  { valor: "480p", etiqueta: "480p" },
  { valor: "720p", etiqueta: "720p" },
  { valor: "1080p", etiqueta: "1080p" },
] as const;

export default function Sistema() {
  const tamano = useSyncExternalStore(suscribirTamanoTexto, leerTamanoTexto, () => "normal" as const);
  const [mando, setMando] = useState(false);
  const [tele, setTele] = useState(false);
  const [calidad, setCalidad] = useState<(typeof CALIDADES)[number]["valor"]>("auto");
  const [interruptor, setInterruptor] = useState(true);
  const [busqueda, setBusqueda] = useState("telenoticias");
  const [chip, setChip] = useState("Todos");
  const [borrados, setBorrados] = useState(0);

  // «Simular mando» y «Simular tele» tocan <html> como lo harían
  // `useRemoteInput` y el guion de arranque, para ver el foco y la escala de
  // diez pies desde un PC.
  // Solo mientras se simula: al apagarlo (o al salir de la página) <html>
  // vuelve a lo que tenía. Antes, al cargar, «Simular mando» apagado ponía
  // `pointer` a la fuerza, y en una tele de verdad el anillo del mando no
  // salía nunca en esta página.
  useEffect(() => {
    if (!mando) return;
    const raiz = document.documentElement;
    const antes = raiz.dataset.input;
    raiz.dataset.input = "dpad";
    return () => {
      if (antes === undefined) delete raiz.dataset.input;
      else raiz.dataset.input = antes;
    };
  }, [mando]);
  useEffect(() => {
    if (!tele) return;
    const raiz = document.documentElement;
    raiz.dataset.pantalla = "tv";
    return () => {
      if (!esTelevisorUA(navigator.userAgent)) delete raiz.dataset.pantalla;
    };
  }, [tele]);

  return (
    <main className="min-h-screen bg-fondo pb-24 text-tinta-1">
      <title>Sistema de diseño · CanalCasa</title>
      <meta name="robots" content="noindex" />
      <ContenedorVista className="pt-12">
        <EncabezadoSeccion
          talla="pagina"
          nivel={1}
          sobretitulo="CanalCasa · src/components/ui"
          titulo="Sistema de diseño"
          descripcion="Cada pieza en sus variantes y estados, con el CSS real de la app. Hover y foco van forzados con data-estado; el resto se puede tocar."
        />

        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[var(--radio-panel)] border border-borde bg-superficie-1 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span id="sis-texto" className="text-sm text-tinta-2">
              Tamaño del texto
            </span>
            <Segmentado
              aria-labelledby="sis-texto"
              tamano="sm"
              opciones={TAMANOS_TEXTO.map((t) => ({
                valor: t,
                etiqueta: t === "normal" ? "Normal" : t === "grande" ? "Grande" : "Muy grande",
              }))}
              valor={tamano}
              onCambio={aplicarTamanoTexto}
            />
          </div>
          <div className="flex items-center gap-3">
            <span id="sis-mando" className="text-sm text-tinta-2">
              Simular mando
            </span>
            <Interruptor aria-labelledby="sis-mando" activo={mando} onCambio={setMando} />
          </div>
          <div className="flex items-center gap-3">
            <span id="sis-tele" className="text-sm text-tinta-2">
              Simular tele (escala en vw)
            </span>
            <Interruptor aria-labelledby="sis-tele" activo={tele} onCambio={setTele} />
          </div>
        </div>

        <Bloque titulo="Color" descripcion="Tokens semánticos de shell.css. Cambiar la paleta es cambiar estos valores.">
          {COLORES.map(([token, nombre]) => (
            <figure key={token} className="m-0 flex items-center gap-3">
              <span
                className="h-12 w-12 shrink-0 rounded-[var(--radio-md)] border border-borde"
                style={{ background: `var(${token})` }}
              />
              <figcaption className="min-w-0">
                <span className="block text-sm">{nombre}</span>
                <code className="text-xs text-tinta-3">{token}</code>
              </figcaption>
            </figure>
          ))}
        </Bloque>

        <Bloque titulo="Texto" descripcion="Ocho tamaños. Crecen en la tele y con «Tamaño del texto»; ninguno baja de 12 px.">
          {TEXTOS.map((t) => (
            <Muestra key={t} nombre={`--texto-${t}`} ancho>
              <span style={{ fontSize: `var(--texto-${t})`, fontWeight: 600 }}>Canal 7 · Telenoticias</span>
            </Muestra>
          ))}
        </Bloque>

        <Bloque titulo="Botón" descripcion="Cuatro papeles. Uno primario por vista; peligro solo para lo que borra.">
          {VARIANTES.map((variante) =>
            ESTADOS.map((estado) => (
              <Muestra key={`${variante}-${estado}`} nombre={`${variante} · ${estado}`}>
                <Boton variante={variante} {...propsDeEstado(estado)}>
                  {variante === "peligro" ? "Borrar" : variante === "primario" ? "Ver ahora" : "Más info"}
                </Boton>
              </Muestra>
            )),
          )}
          <Muestra nombre="tallas sm · md · lg" ancho>
            <Boton variante="primario" tamano="sm">
              Pequeño
            </Boton>
            <Boton variante="primario" tamano="md">
              Mediano
            </Boton>
            <Boton variante="primario" tamano="lg">
              Grande
            </Boton>
          </Muestra>
          <Muestra nombre="con icono · icono final · enlace (Link) · pulsado (aria-pressed)" ancho>
            <Boton variante="primario" icono={<Play />}>
              Reproducir
            </Boton>
            <Boton iconoFinal={<ArrowRight />}>Ver todo</Boton>
            <Boton href="/sistema" variante="secundario">
              Soy un enlace
            </Boton>
            <Boton icono={<Star />} aria-pressed={true}>
              En favoritos
            </Boton>
          </Muestra>
          <Muestra nombre="ancho completo (formularios en el teléfono)" ancho>
            <div className="w-full max-w-sm">
              <Boton variante="primario" tamano="lg" anchoCompleto icono={<Plus />}>
                Añadir
              </Boton>
            </div>
          </Muestra>
        </Bloque>

        <Bloque titulo="Botón de icono" descripcion="Redondo, con aria-label obligatorio.">
          {VARIANTES.map((variante) =>
            ESTADOS.map((estado) => (
              <Muestra key={`i-${variante}-${estado}`} nombre={`${variante} · ${estado}`}>
                <BotonIcono
                  variante={variante}
                  aria-label="Ajustes"
                  icono={variante === "peligro" ? <Trash2 /> : variante === "fantasma" ? <X /> : <Settings />}
                  {...propsDeEstado(estado)}
                />
              </Muestra>
            )),
          )}
          <Muestra nombre="tallas sm · md · lg">
            <BotonIcono tamano="sm" aria-label="Me gusta" icono={<Heart />} />
            <BotonIcono tamano="md" aria-label="Me gusta" icono={<Heart />} />
            <BotonIcono tamano="lg" aria-label="Me gusta" icono={<Heart />} />
          </Muestra>
        </Bloque>

        <Bloque titulo="Chip" descripcion="Elegido = acento. Foco = anillo blanco. Si coinciden, se suman.">
          {ESTADOS.map((estado) => (
            <Muestra key={`c-${estado}`} nombre={`reposo · ${estado}`}>
              <Chip {...propsDeEstado(estado)}>Deportes</Chip>
            </Muestra>
          ))}
          <Muestra nombre="activo">
            <Chip activo>Noticias</Chip>
          </Muestra>
          <Muestra nombre="activo · foco">
            <Chip activo data-estado="foco">
              Noticias
            </Chip>
          </Muestra>
          <Muestra nombre="con contador · con icono">
            <Chip contador={128}>Guatemala</Chip>
            <Chip icono={<Star />}>Favoritos</Chip>
          </Muestra>
          <Muestra nombre="interactivo (aria-pressed)" ancho>
            {["Todos", "Noticias", "Deportes", "Infantil", "Películas"].map((c) => (
              <Chip key={c} activo={chip === c} onClick={() => setChip(c)}>
                {c}
              </Chip>
            ))}
          </Muestra>
          <Muestra nombre="como enlace: aria-current=&quot;true&quot;, nunca &quot;page&quot;" ancho>
            <Chip href="/sistema" activo>
              Acción
            </Chip>
            <Chip href="/sistema">Comedia</Chip>
          </Muestra>
        </Bloque>

        <Bloque
          titulo="Segmentado"
          descripcion="radiogroup. Las flechas mueven el foco; elegir es OK o clic. La opción elegida lleva el acento."
        >
          <Muestra nombre="interactivo" ancho>
            <Segmentado etiqueta="Calidad" opciones={CALIDADES} valor={calidad} onCambio={setCalidad} />
          </Muestra>
          <Muestra nombre="hover en «720p»" ancho>
            <Forzar estado="hover" selector=".ui-segmento:nth-child(3)">
              <Segmentado etiqueta="Calidad" opciones={CALIDADES} valor="auto" onCambio={() => {}} />
            </Forzar>
          </Muestra>
          <Muestra nombre="foco en «720p» · foco en la elegida" ancho>
            <Forzar estado="foco" selector=".ui-segmento:nth-child(3)">
              <Segmentado etiqueta="Calidad" opciones={CALIDADES} valor="auto" onCambio={() => {}} />
            </Forzar>
            <Forzar estado="foco" selector=".ui-segmento:nth-child(1)">
              <Segmentado etiqueta="Calidad" opciones={CALIDADES} valor="auto" onCambio={() => {}} />
            </Forzar>
          </Muestra>
          <Muestra nombre="opción deshabilitada · talla sm · ancho completo" ancho>
            <Segmentado
              etiqueta="Imagen"
              opciones={[
                { valor: "a", etiqueta: "Completa" },
                { valor: "b", etiqueta: "Llenar" },
                { valor: "c", etiqueta: "Estirar", deshabilitada: true },
              ]}
              valor="a"
              onCambio={() => {}}
            />
            <Segmentado
              etiqueta="Vista"
              tamano="sm"
              opciones={[
                { valor: "l", etiqueta: "Lista" },
                { valor: "p", etiqueta: "Parrilla" },
              ]}
              valor="l"
              onCambio={() => {}}
            />
            <div className="w-full max-w-md">
              <Segmentado
                etiqueta="Tipo"
                anchoCompleto
                opciones={[
                  { valor: "t", etiqueta: "Todo" },
                  { valor: "p", etiqueta: "Películas" },
                  { valor: "s", etiqueta: "Series" },
                ]}
                valor="p"
                onCambio={() => {}}
              />
            </div>
          </Muestra>
        </Bloque>

        <Bloque titulo="Interruptor" descripcion="role=switch. El pomo se centra con flexbox y se mueve con transform.">
          {(["apagado", "encendido"] as const).map((lado) =>
            (["reposo", "hover", "foco", "deshabilitado"] as const).map((estado) => (
              <Muestra key={`s-${lado}-${estado}`} nombre={`${lado} · ${estado}`}>
                <Interruptor
                  etiqueta={`Ejemplo ${lado}`}
                  activo={lado === "encendido"}
                  onCambio={() => {}}
                  {...propsDeEstado(estado)}
                />
              </Muestra>
            )),
          )}
          <Muestra nombre="interactivo">
            <Interruptor etiqueta="Empezar con sonido" activo={interruptor} onCambio={setInterruptor} />
          </Muestra>
        </Bloque>

        <Bloque titulo="Campo" descripcion="El foco se ve en la píldora (:focus-within). Encoge hasta 320 px.">
          <Muestra nombre="reposo, con etiqueta visible" ancho>
            <div className="w-full max-w-md">
              <Campo etiqueta="Enlace del vídeo" placeholder="https://… o magnet:…" />
            </div>
          </Muestra>
          <Muestra nombre="foco (forzado)" ancho>
            <div className="w-full max-w-md">
              <Forzar estado="foco" selector=".ui-campo">
                <Campo etiqueta="Nombre" defaultValue="Partido del domingo" />
              </Forzar>
            </div>
          </Muestra>
          <Muestra nombre="búsqueda limpiable (interactiva)" ancho>
            <div className="w-full max-w-md">
              <CampoBusqueda
                etiqueta="Buscar canales"
                placeholder="Buscar canales"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onLimpiar={() => setBusqueda("")}
              />
            </div>
          </Muestra>
          <Muestra nombre="inválido con ayuda" ancho>
            <div className="w-full max-w-md">
              <Campo
                etiqueta="Enlace del vídeo"
                defaultValue="htps:/mal"
                invalido
                ayuda="Ese enlace no empieza por https:// ni por magnet:"
              />
            </div>
          </Muestra>
          <Muestra nombre="deshabilitado · talla lg" ancho>
            <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo etiqueta="Deshabilitado" disabled placeholder="No disponible" />
              <Campo etiqueta="Grande" tamano="lg" placeholder="Para el formulario principal" />
            </div>
          </Muestra>
        </Bloque>

        <Bloque titulo="Encabezado de sección" descripcion="Tres tallas con nombre; el nivel del h* va aparte.">
          <Muestra nombre="pagina" ancho>
            <EncabezadoSeccion talla="pagina" sobretitulo="Pega el enlace de un vídeo y míralo aquí" titulo="Mi enlace" />
          </Muestra>
          <Muestra nombre="seccion con acción" ancho>
            <div className="w-full">
              <EncabezadoSeccion
                talla="seccion"
                titulo="Seguir viendo"
                accion={
                  <Boton variante="fantasma" tamano="sm" iconoFinal={<ArrowRight />}>
                    Ver todo
                  </Boton>
                }
              />
            </div>
          </Muestra>
          <Muestra nombre="grupo (versalitas)" ancho>
            <EncabezadoSeccion talla="grupo" titulo="Reproducción" />
          </Muestra>
        </Bloque>

        <Bloque titulo="Aviso" descripcion="El color nunca va solo: cada tono lleva su icono.">
          <Muestra nombre="info" ancho>
            <Aviso tono="info" className="w-full">
              La lista de canales se actualiza sola cada día.
            </Aviso>
          </Muestra>
          <Muestra nombre="éxito con cerrar" ancho>
            <Aviso tono="exito" className="w-full" onCerrar={() => {}}>
              Enlace guardado en este dispositivo.
            </Aviso>
          </Muestra>
          <Muestra nombre="aviso con título" ancho>
            <Aviso tono="aviso" className="w-full" titulo="Este enlace caduca">
              Funcionará mientras el servidor lo dé por válido. Cuando deje de hacerlo, vuelve a copiarlo.
            </Aviso>
          </Muestra>
          <Muestra nombre="peligro con acción" ancho>
            <Aviso tono="peligro" className="w-full" accion={{ texto: "Reintentar", onClick: () => {} }}>
              No se pudo cargar la lista de canales.
            </Aviso>
          </Muestra>
        </Bloque>

        <Bloque titulo="Estado vacío" descripcion="Icono, título, texto y acciones, siempre en ese orden.">
          <Muestra nombre="sección, con acciones" ancho>
            <div className="w-full">
              <EstadoVacio
                icono={<Inbox />}
                titulo="Todavía no hay favoritos"
                texto="Marca un canal con la estrella y aparecerá aquí, a un toque."
                acciones={
                  <>
                    <Boton variante="primario">Ver canales</Boton>
                    <Boton variante="fantasma">Cómo funciona</Boton>
                  </>
                }
              />
            </div>
          </Muestra>
          <Muestra nombre="pantalla: ver /no-existe" ancho>
            <Boton href="/no-existe" iconoFinal={<ArrowRight />}>
              Abrir la 404
            </Boton>
          </Muestra>
        </Bloque>

        <Bloque
          titulo="Confirmación"
          descripcion="En dos pasos y en línea. El primer OK pregunta y deja el foco en «No»; Atrás o Escape cancelan."
        >
          <Muestra nombre={`interactiva · borrados ${borrados} veces`} ancho>
            <Confirmacion
              icono={<Trash2 />}
              pregunta="¿Borrar 12 favoritos?"
              onConfirmar={() => setBorrados((n) => n + 1)}
            >
              Borrar todos
            </Confirmacion>
          </Muestra>
          <Muestra nombre="deshabilitada (no hay nada que borrar)">
            <Confirmacion pregunta="" onConfirmar={() => {}} disabled>
              Borrar todos
            </Confirmacion>
          </Muestra>
        </Bloque>

        <Bloque
          titulo="Contenedor de vista"
          descripcion="Esta página va dentro de uno: --margen a los lados a cualquier ancho. Lectura 880 px, medio 1.100 px, completo sin tope."
        >
          <Muestra nombre="lectura · medio · completo" ancho>
            <div className="w-full space-y-2">
              {(["lectura", "medio", "completo"] as const).map((ancho) => (
                <ContenedorVista key={ancho} ancho={ancho} className="px-0!">
                  <div className="rounded-[var(--radio-md)] bg-relleno px-4 py-2 text-sm text-tinta-2">{ancho}</div>
                </ContenedorVista>
              ))}
            </div>
          </Muestra>
        </Bloque>
      </ContenedorVista>
    </main>
  );
}
