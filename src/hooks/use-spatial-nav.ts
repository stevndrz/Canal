"use client";

import { useCallback, useEffect } from "react";
import { esPunteroTosco, esTelevisorUA } from "@/lib/dispositivo";

/** Códigos de tecla de los mandos reales, además de las flechas del teclado. */
const BACK_KEYCODES = new Set([
  10009, // Samsung Tizen
  461, // LG webOS
  27, // Escape
]);

/**
 * ¿Es la tecla Atrás del mando?
 *
 * Exportada porque no solo la necesita este hook: `fullscreen-player.tsx`
 * desactiva `useSpatialNav` entero mientras se ve la tele —las flechas
 * zapean, no navegan la rejilla— así que tiene su propio `keydown` y con él
 * su propia necesidad de reconocer Atrás. Una sola función evita que las dos
 * rutas un día reconozcan teclas distintas.
 *
 * No mira `Backspace`: aquí no hay ningún campo de texto donde esa tecla
 * pudiera significar «borrar una letra» en vez de «volver».
 */
export function esTeclaAtras(event: Pick<KeyboardEvent, "key" | "keyCode">): boolean {
  return (
    BACK_KEYCODES.has(event.keyCode) ||
    event.key === "Escape" ||
    event.key === "GoBack" ||
    event.key === "BrowserBack"
  );
}

type Dir = "up" | "down" | "left" | "right";

interface Candidate {
  el: HTMLElement;
  rect: DOMRect;
  /** Vive en una barra fija (navegación), no en el contenido que scrollea. */
  chrome: boolean;
}

/**
 * Un candidato tiene que poder recibir el foco de verdad: `.focus()` sobre un
 * `<div>` corriente no hace nada y no avisa, así que la navegación se atasca
 * sin un solo error en consola. Pasó al marcar con `data-nav` el contenedor de
 * scroll de un carril: ese div enorme ganaba por cercanía y el foco no salía
 * de la barra. Se comprueba aquí en vez de confiar en que no se repita.
 */
const ENFOCABLES = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "VIDEO"]);

function esEnfocable(el: HTMLElement): boolean {
  if (el.tabIndex >= 0) return true;
  return ENFOCABLES.has(el.tagName) && !el.hasAttribute("disabled");
}

function collect(root: HTMLElement): Candidate[] {
  return [...root.querySelectorAll<HTMLElement>("[data-nav]")]
    .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null && esEnfocable(el))
    .map((el) => ({
      el,
      rect: el.getBoundingClientRect(),
      chrome: el.closest("[data-nav-chrome]") !== null,
    }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0);
}

/**
 * Lo que cuesta salir del contenido para ir a una barra fija.
 *
 * Las barras de navegación no se mueven con el scroll, así que geométricamente
 * están siempre pegadas al borde: al pulsar arriba desde cualquier riel, la
 * barra superior ganaba siempre y no se podía volver al riel de encima. Con
 * esta penalización solo gana cuando de verdad no hay nada de contenido en esa
 * dirección, que es cuando se quiere ir a ella.
 */
const COSTE_CHROME = 4000;

/**
 * Navegación espacial geométrica: elige el vecino real en la dirección
 * pulsada, no el siguiente en el orden del DOM. Es lo que hace que el
 * mando se sienta como una app de TV y no como tabular en una web.
 */
function pick(
  from: DOMRect,
  candidates: Candidate[],
  dir: Dir,
  desdeChrome: boolean,
): HTMLElement | null {
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach(({ el, rect, chrome }) => {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;

    // Debe estar realmente en esa dirección, con un umbral que evita
    // que un vecino casi alineado gane por 1px.
    const primary =
      dir === "up" ? -dy : dir === "down" ? dy : dir === "left" ? -dx : dx;
    if (primary < 12) return;

    const vertical = dir === "up" || dir === "down";

    // Izquierda y derecha no cambian de fila.
    //
    // Sin esta condición, pulsar derecha en el último botón del hero saltaba a
    // la barra de navegación: está a la derecha y arriba, y la penalización por
    // desviación no bastaba para descartarla. En una interfaz de televisor las
    // filas son horizontales, así que el eje que se recorre con izquierda y
    // derecha tiene que ser el de la fila en la que ya estás. Arriba y abajo
    // sí cambian de fila, y ahí la desviación lateral solo se penaliza: el
    // contenido es ancho y exigir la misma columna dejaría filas inalcanzables.
    if (!vertical) {
      const solape = Math.min(from.bottom, rect.bottom) - Math.max(from.top, rect.top);
      if (solape <= 0) return;
    }

    const secondary = vertical ? Math.abs(dx) : Math.abs(dy);

    // Penaliza la desviación lateral: preferimos la misma columna/fila. Y
    // salir del contenido hacia una barra fija cuesta, salvo que ya se venga
    // de una: moverse dentro de la propia barra tiene que seguir siendo libre.
    const score = primary + secondary * 2.2 + (chrome && !desdeChrome ? COSTE_CHROME : 0);
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  });

  return best;
}

/**
 * ¿Esta flecha saca el foco de un campo de texto, o es del cursor?
 *
 * Antes ninguna flecha salía de un `<input>`: el campo de Buscar (con
 * `autoFocus`) y el de Canales atrapaban el mando, y en la tele no había forma
 * de llegar al teclado en pantalla ni a la lista. La regla es una sola para
 * todos los campos, no un parche por vista:
 *
 * - ↑ y ↓ siempre salen de un campo de UNA línea, donde no tienen nada que
 *   hacer. En un `<textarea>` mueven el cursor entre líneas: se quedan.
 * - ← y → salen solo desde el borde: con el campo vacío, o con el cursor al
 *   principio (←) o al final (→) y nada seleccionado. Dentro del texto siguen
 *   moviendo el cursor, que es lo que espera quien escribe con un teclado.
 *
 * El precio, aceptado: en el PC, ↑/↓ ya no llevan el cursor al principio o al
 * final del campo.
 */
export function saleDelCampo(
  campo: Pick<HTMLInputElement, "tagName" | "value" | "selectionStart" | "selectionEnd">,
  tecla: string,
): boolean {
  const unaLinea = campo.tagName === "INPUT";
  if (tecla === "ArrowUp" || tecla === "ArrowDown") return unaLinea;
  if (tecla !== "ArrowLeft" && tecla !== "ArrowRight") return false;
  if (campo.value.length === 0) return true;
  const { selectionStart: inicio, selectionEnd: fin } = campo;
  // Campos sin cursor que consultar (email, number): las flechas son suyas.
  if (inicio === null || fin === null || inicio !== fin) return false;
  return tecla === "ArrowLeft" ? inicio === 0 : fin === campo.value.length;
}

/**
 * El dígito de una tecla, o `null`. Por nombre y, si no lo trae, por código:
 * hay mandos que mandan los números como "Unidentified" con su keyCode de
 * siempre (48-57, o 96-105 del teclado numérico).
 */
export function digitoDeTecla(evento: Pick<KeyboardEvent, "key" | "keyCode">): string | null {
  if (/^[0-9]$/.test(evento.key)) return evento.key;
  if (evento.key && evento.key !== "Unidentified") return null;
  if (evento.keyCode >= 48 && evento.keyCode <= 57) return String(evento.keyCode - 48);
  if (evento.keyCode >= 96 && evento.keyCode <= 105) return String(evento.keyCode - 96);
  return null;
}

/**
 * El destino por el que se entra a una vista.
 *
 * `focusFirst` cogía el primer `[data-nav]` del DOM, que es la marca de la
 * barra: al entrar a Canales con el mando, el foco se quedaba arriba y hacían
 * falta varias ↓ —pasando por el vídeo— para llegar a la lista. Una vista
 * marca su entrada con `data-nav-entrada`, en el propio destino o en un
 * contenedor (entonces vale su primer destino). La lista de Canales, por
 * ejemplo, es un contenedor virtual: su primera fila cambia y no puede llevar
 * la marca ella misma.
 */
function destinoDeEntrada(root: HTMLElement, candidatos: Candidate[]): Candidate | null {
  const anclas = root.querySelectorAll<HTMLElement>("[data-nav-entrada]");
  for (const ancla of anclas) {
    const dentro = candidatos.find(({ el }) => el === ancla || ancla.contains(el));
    if (dentro) return dentro;
  }
  return null;
}

/**
 * Entrar a un grupo (`data-nav-grupo`) desde fuera lleva a su elemento
 * marcado (`aria-pressed="true"`), no al que quede más cerca.
 *
 * Nació con los puntos del héroe de Cine y series: al llegar con → desde
 * «Mi lista», el foco caía en el primer punto aunque el destacado elegido
 * fuera el cuarto, y había que buscarlo. Dentro del grupo, las flechas
 * siguen siendo geométricas.
 */
function entradaDeGrupo(siguiente: HTMLElement, actual: HTMLElement): HTMLElement {
  const grupo = siguiente.closest<HTMLElement>("[data-nav-grupo]");
  if (!grupo || grupo.contains(actual)) return siguiente;
  return grupo.querySelector<HTMLElement>('[data-nav][aria-pressed="true"]') ?? siguiente;
}

/**
 * La caja de un destino, contando el título de su sección si es el primero.
 *
 * En Canales, al entrar con el mando, la primera fila quedaba justo debajo
 * de la barra y su título («Mis canales») por detrás de ella: se veía la
 * lista, pero no de qué era. Si la fila de encima es un título de sección,
 * el borde de arriba que hay que dejar a la vista es el del título.
 */
export function cajaConTitulo(el: HTMLElement): { top: number; bottom: number } {
  const caja = el.getBoundingClientRect();
  const previa = el.closest(".livetv-item")?.previousElementSibling;
  if (previa?.classList.contains("livetv-seccion")) {
    return { top: previa.getBoundingClientRect().top, bottom: caja.bottom };
  }
  return { top: caja.top, bottom: caja.bottom };
}

/**
 * Deja a la vista, por debajo de la barra fija, un destino al que se ha
 * llevado el foco sin desplazar (`preventScroll`). El scroll nativo de
 * `focus()` lo pegaba al borde de arriba, debajo de la barra.
 */
function aLaVistaEnLaVentana(el: HTMLElement) {
  const caja = cajaConTitulo(el);
  let barra = 0;
  for (const cromo of document.querySelectorAll<HTMLElement>("[data-nav-chrome]")) {
    const r = cromo.getBoundingClientRect();
    if (r.height > 0 && r.top <= 0) barra = Math.max(barra, r.bottom);
  }
  if (caja.top < barra + 8 || caja.bottom > window.innerHeight - 8) {
    window.scrollBy({ top: caja.top - barra - 24 });
  }
}

/** Deja el elemento a la vista sin usar scrollIntoView (mueve la ventana en Tizen). */
export function scrollNearest(el: HTMLElement) {
  let parent = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const scrollsY = /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight;
    const scrollsX = /(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth;

    if (scrollsY || scrollsX) {
      const er = el.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      const pad = 28;
      if (scrollsY) {
        if (er.top < pr.top + pad) parent.scrollTop += er.top - pr.top - pad;
        else if (er.bottom > pr.bottom - pad) parent.scrollTop += er.bottom - pr.bottom + pad;
      }
      if (scrollsX) {
        if (er.left < pr.left + pad) parent.scrollLeft += er.left - pr.left - pad;
        else if (er.right > pr.right - pad) parent.scrollLeft += er.right - pr.right + pad;
      }
    }
    parent = parent.parentElement;
  }
}

export interface SpatialNavOptions {
  /** Contenedor donde buscar elementos [data-nav]. */
  rootRef: React.RefObject<HTMLElement | null>;
  /** Tecla Atrás del mando (Escape / 10009 Tizen / 461 webOS). */
  onBack?: () => void;
  /** Dígito 0-9 del mando para canal directo. */
  onDigit?: (digit: string) => void;
  /**
   * Desactiva el movimiento del foco, no la tecla Atrás.
   *
   * Durante la reproducción no queremos que las flechas muevan el foco por
   * debajo del vídeo, pero Atrás tiene que seguir funcionando: es la única
   * forma de salir con un mando, que no tiene ratón ni Tab.
   */
  enabled?: boolean;
}

export function useSpatialNav({ rootRef, onBack, onDigit, enabled = true }: SpatialNavOptions) {
  /**
   * Deja el foco en el primer elemento navegable.
   *
   * Un mando de televisor no tiene Tab: si al entrar en una pantalla no hay
   * nada enfocado, las flechas no tienen desde dónde partir y el mando no
   * responde. En ratón esto no se nota porque se pulsa directamente.
   */
  const focusFirst = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    /**
     * En una pantalla táctil, no.
     *
     * Esto existe para el mando: sin nada enfocado, las flechas no tienen
     * desde dónde partir. En un teléfono no hay flechas, y lo único que se
     * consigue es dibujar un recuadro blanco alrededor del primer destino
     * nada más abrir la app — que es exactamente lo que se veía y parecía un
     * fallo de pintado.
     *
     * Se comprueba el tipo de puntero y no el ancho: un televisor con
     * mando-puntero es «coarse» y ahí el anillo tampoco ayuda, mientras que
     * una ventana estrecha en un ordenador sí lo necesita.
     *
     * Pero «coarse» por sí solo no distingue mando de dedo — lo dice el
     * comentario de `esPunteroTosco`, y aquí es donde de verdad importa: en
     * un televisor Tizen/WebOS real, `pointer: coarse` da true igual que en
     * un teléfono. Sin este `esMando`, volver de pantalla completa se
     * quedaba con el foco huérfano — nada enfocado y `focusFirst` rindiéndose
     * siempre, así que las flechas de `focusIn` no tenían desde dónde
     * arrancar. `useRemoteInput` ya marca `data-input="dpad"` en cuanto llega
     * una flecha DE VERDAD; si ya llegó una, esto es un mando y no un dedo,
     * así que el anillo de foco es bienvenido y no un defecto de pintado.
     *
     * Y por si `focusFirst` corre ANTES de la primera flecha real —no
     * debería pasar en un televisor, que arranca directo en el reproductor,
     * pero mejor no depender solo de ese orden—, el User-Agent es la segunda
     * señal: la misma tabla que ya decide el servidor de vídeo en el server
     * (`esTelevisorUA`), aquí en el cliente.
     */
    const esMando =
      document.documentElement.dataset.input === "dpad" ||
      (typeof navigator !== "undefined" && esTelevisorUA(navigator.userAgent));
    if (esPunteroTosco() && !esMando) return;
    /**
     * Con ratón y teclado, tampoco al cargar: Chrome pinta el anillo en un
     * `.focus()` de guion mientras no haya habido un clic, y en el PC se veía
     * un recuadro blanco alrededor de la marca nada más abrir Inicio
     * (`focusVisible: false` no lo evita). No hace falta: la primera flecha
     * entra por `focusIn`, que ya sabe arrancar sin foco, y el tabulador
     * funciona como en cualquier web. Ya enfocado algo, sí se sigue.
     */
    if (!esMando && (!document.activeElement || document.activeElement === document.body)) return;
    const candidates = collect(root);
    const entrada = destinoDeEntrada(root, candidates);
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && root.contains(active) && active.hasAttribute("data-nav")) {
      /**
       * Ya hay foco: se respeta… salvo que se venga de la barra con el mando
       * y la vista tenga entrada. Es «OK en Canales»: quien lo pulsa quiere
       * ir a la lista, no quedarse en la pestaña. Con ratón no se toca: el
       * clic en la pestaña no debe desplazar la página por debajo del vídeo.
       */
      const desdeLaBarra = active.closest("[data-nav-chrome]") !== null;
      if (!(esMando && desdeLaBarra && entrada)) return;
    }
    const primero = entrada ?? candidates[0];
    if (primero) {
      primero.el.focus({ preventScroll: true });
      if (entrada && esMando) aLaVistaEnLaVentana(primero.el);
      scrollNearest(primero.el);
    }
  }, [rootRef]);

  const focusIn = useCallback((dir: Dir) => {
    const root = rootRef.current;
    if (!root) return;

    const candidates = collect(root);
    if (candidates.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const current = active && root.contains(active) && active.hasAttribute("data-nav") ? active : null;

    if (!current) {
      const primero = destinoDeEntrada(root, candidates) ?? candidates[0];
      primero.el.focus();
      scrollNearest(primero.el);
      return;
    }

    const from = current.getBoundingClientRect();
    const next = pick(
      from,
      candidates.filter(({ el }) => el !== current),
      dir,
      current.closest("[data-nav-chrome]") !== null,
    );
    if (next) {
      const destino = entradaDeGrupo(next, current);
      destino.focus();
      scrollNearest(destino);
    }
  }, [rootRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Dentro de un campo, las teclas son de quien escribe salvo las flechas
      // que lo abandonan (ver `saleDelCampo`).
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      /**
       * Un diálogo abierto manda sobre todo esto.
       *
       * Mientras hay un `role="dialog"` con el foco dentro, las teclas son
       * suyas: sus flechas las mueve su propia rejilla y su Atrás lo cierra.
       * Sin esta guarda pasaban las dos cosas a la vez —el foco se movía dos
       * veces por pulsación, porque el diálogo y este hook lo empujaban cada
       * uno por su lado— y Atrás cerraba el diálogo **y** salía de la sección
       * entera de un tirón. Se vio con el panel de géneros del catálogo.
       */
      if (target?.closest?.('[role="dialog"]')) return;

      // Atrás se atiende siempre, incluso con el foco desactivado: es lo que
      // saca del reproductor en un televisor. Escribiendo en un campo,
      // Retroceso borra una letra y no debe salir de la pantalla.
      const esAtras = esTeclaAtras(event) || (event.key === "Backspace" && !typing);

      if (esAtras) {
        event.preventDefault();
        onBack?.();
        return;
      }

      /**
       * Otro ya atendió esta tecla (la rejilla de servidores, el campo de
       * Canales llevando el foco a los chips…). Moverlo otra vez aquí era el
       * «doble salto»: cada flecha avanzaba dos.
       */
      if (event.defaultPrevented) return;

      /**
       * Los dígitos marcan canal ANTES de mirar `enabled`: a pantalla completa
       * el hook está apagado para las flechas (zapean), y ahí es justo donde
       * arranca la tele y donde más se marca. Antes este `return` iba primero
       * y 1-0-3 no hacía nada. Dentro de un campo, nunca: un «7» escrito en el
       * buscador es un 7, no un cambio de canal.
       */
      const digito = typing ? null : digitoDeTecla(event);
      if (digito !== null) {
        if (onDigit) {
          event.preventDefault();
          onDigit(digito);
        }
        return;
      }

      if (!enabled) return;
      if (typing && !saleDelCampo(target as HTMLInputElement, event.key)) return;

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          focusIn("up");
          return;
        case "ArrowDown":
          event.preventDefault();
          focusIn("down");
          return;
        case "ArrowLeft":
          event.preventDefault();
          focusIn("left");
          return;
        case "ArrowRight":
          event.preventDefault();
          focusIn("right");
          return;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, focusIn, onBack, onDigit]);

  return { focusIn, focusFirst };
}

/**
 * Marca en <html> si el usuario está en mando o en puntero. Deja que el CSS
 * muestre el foco siempre en TV sin ensuciar el ratón con anillos.
 */
export function useRemoteInput() {
  useEffect(() => {
    const set = (mode: "dpad" | "pointer") => {
      document.documentElement.dataset.input = mode;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key.startsWith("Arrow") || event.key === "Enter") set("dpad");
    };
    const onPointer = () => set("pointer");

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);
}
