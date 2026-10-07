"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { esTeclaAtras } from "@/hooks/use-spatial-nav";
import { esTelevisorUA } from "@/lib/dispositivo";
import { EstadoVacio } from "./estado-vacio";
import { indiceSiguiente } from "./teclas";

/**
 * Una pantalla entera con un solo mensaje: la 404 y el error general.
 *
 * Estas pantallas viven fuera del armazón: no hay barra, ni `useSpatialNav`,
 * ni nadie que escuche el mando. Antes, en la 404 el foco se quedaba en
 * `<body>` y ni las flechas ni Atrás hacían nada: en una tele, un callejón
 * sin salida que solo se arreglaba apagándola. Aquí se cubre lo mínimo:
 *
 * - **Primer foco** en la primera acción, solo en una tele. En el teléfono
 *   y en el PC no: un anillo blanco nada más cargar parece un fallo de
 *   pintado, y con teclado basta un Tab.
 * - **Flechas** entre las acciones, en el orden en que se ven. Si no hay
 *   nada enfocado, la primera flecha enfoca la primera acción.
 * - **Atrás** (Escape, 10009 de Tizen, 461 de webOS) lleva a Inicio, o a
 *   donde diga `alAtras`.
 */
export function PantallaMensaje({
  icono,
  titulo,
  texto,
  acciones,
  alAtras,
}: {
  icono?: ReactNode;
  titulo: ReactNode;
  texto?: ReactNode;
  acciones: ReactNode;
  /** Qué hace Atrás. Por defecto, ir a Inicio. */
  alAtras?: () => void;
}) {
  const router = useRouter();
  const raiz = useRef<HTMLElement>(null);

  // `alAtras` cambia de identidad en cada render del padre; guardado en una
  // ref, el efecto de teclado se monta una vez y no se pierde ninguna tecla
  // entre desmontar y volver a montar el oyente.
  const atras = useRef(alAtras);
  useEffect(() => {
    atras.current = alAtras;
  }, [alAtras]);

  useEffect(() => {
    const destinos = () => [...(raiz.current?.querySelectorAll<HTMLElement>("[data-nav]") ?? [])];

    if (esTelevisorUA(navigator.userAgent)) destinos()[0]?.focus({ preventScroll: true });

    const alPulsar = (evento: KeyboardEvent) => {
      if (esTeclaAtras(evento)) {
        evento.preventDefault();
        if (atras.current) atras.current();
        else router.push("/");
        return;
      }
      const lista = destinos();
      if (lista.length === 0) return;
      const actual = lista.indexOf(document.activeElement as HTMLElement);
      if (actual === -1) {
        if (evento.key.startsWith("Arrow")) {
          evento.preventDefault();
          lista[0].focus();
        }
        return;
      }
      const destino = indiceSiguiente(actual, lista.length, evento.key, "ambas");
      if (destino === null) return;
      evento.preventDefault();
      lista[destino].focus();
    };

    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [router]);

  return (
    <main ref={raiz} className="pantalla-mensaje">
      <EstadoVacio talla="pantalla" icono={icono} titulo={titulo} texto={texto} acciones={acciones} />
    </main>
  );
}
