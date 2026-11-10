"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { publicConfig } from "@/lib/config";
import { abrirCanalDeSala, type CanalDeSala, type MiembroDeSala } from "@/lib/ver-juntos/conexion";
import type { Perfil } from "@/lib/ver-juntos/recordar";
import {
  hayQueCorregir,
  leerMensajeReloj,
  leerReloj,
  pausarReloj,
  reanudarReloj,
  relojEn,
  RELOJ_PARADO,
  type MensajeReloj,
  type Reloj,
  type TituloDeSala,
} from "@/lib/ver-juntos/reloj";

/**
 * Sincronía suave: la sala lleva el reloj de una película que no puede mandar
 * (el iframe de Vimeus). Ver `lib/ver-juntos/reloj.ts`.
 *
 * Lo que comparte con Ver juntos de «Nuestras películas»: la misma sala (su
 * código, su presencia, su firma) y la misma cuenta atrás. Lo que no: aquí no
 * hay `<video>`; cada persona pausa y corrige su reproductor a mano.
 */

const EVENTO = "client-reloj";
const PULSO_MS = 5000;
const CUENTA_S = 3;

export type EstadoRelojSala = "fuera" | "conectando" | "conectada" | "error";

const ahoraLocal = () => performance.now();

export function useRelojSala({ perfil, codigo, titulo }: { perfil: Perfil | null; codigo: string; titulo: TituloDeSala }) {
  const activa = Boolean(perfil && codigo && publicConfig.pusherKey);
  const [conexion, setConexion] = useState<{ codigo: string; estado: "conectada" | "error" } | null>(null);
  const [miembros, setMiembros] = useState<MiembroDeSala[]>([]);
  const [listos, setListos] = useState<string[]>([]);
  const [reloj, setReloj] = useState<Reloj>(RELOJ_PARADO);
  /** Se puso en marcha alguna vez: antes de eso no hay «deberían ir por». */
  const [empezado, setEmpezado] = useState(false);
  const [cuenta, setCuenta] = useState<number | null>(null);
  const [segundos, setSegundos] = useState(0);
  /** El título que tiene puesto otro de la sala, si no es el de este aparato. */
  const [otroTitulo, setOtroTitulo] = useState<(TituloDeSala & { de: string }) | null>(null);

  const canalRef = useRef<CanalDeSala | null>(null);
  const relojRef = useRef(reloj);
  const empezadoRef = useRef(empezado);
  const miembrosRef = useRef(miembros);
  const tituloRef = useRef(titulo);
  const yo = perfil?.id ?? "";
  useEffect(() => {
    relojRef.current = reloj;
    empezadoRef.current = empezado;
    miembrosRef.current = miembros;
    tituloRef.current = titulo;
  });

  const enviar = useCallback((mensaje: MensajeReloj) => canalRef.current?.enviar(mensaje), []);
  const fijar = useCallback((nuevo: Reloj) => {
    relojRef.current = nuevo;
    setReloj(nuevo);
    setSegundos(Math.floor(leerReloj(nuevo, ahoraLocal())));
    empezadoRef.current = true;
    setEmpezado(true);
  }, []);
  const contarReloj = useCallback(
    (pulso = false) => {
      const r = relojRef.current;
      enviar({ tipo: "reloj", tiempo: leerReloj(r, ahoraLocal()), pausado: r.desde === null, pulso });
    },
    [enviar],
  );

  // --- La conexión -------------------------------------------------------------
  useEffect(() => {
    if (!activa || !perfil) return undefined;
    const canal = abrirCanalDeSala(perfil, codigo, EVENTO, {
      miembros: (lista) => {
        setMiembros(lista);
        // Quien se fue ya no está listo.
        setListos((antes) => antes.filter((id) => lista.some((m) => m.id === id)));
      },
      dentro: () => {
        setConexion({ codigo, estado: "conectada" });
        canal.enviar({ tipo: "hola" } satisfies MensajeReloj);
        canal.enviar({ tipo: "titulo", titulo: tituloRef.current } satisfies MensajeReloj);
      },
      error: () => setConexion({ codigo, estado: "error" }),
      mensaje: (dato, de) => {
        const mensaje = leerMensajeReloj(dato);
        if (!mensaje) return;
        if (mensaje.tipo === "hola") {
          canal.enviar({ tipo: "titulo", titulo: tituloRef.current } satisfies MensajeReloj);
          // A quien llega se le cuenta por dónde va la sala, si ya empezó.
          if (empezadoRef.current) {
            const r = relojRef.current;
            canal.enviar({ tipo: "reloj", tiempo: leerReloj(r, ahoraLocal()), pausado: r.desde === null } satisfies MensajeReloj);
          }
        } else if (mensaje.tipo === "listo" && de) {
          setListos((antes) => (mensaje.listo ? [...new Set([...antes, de])] : antes.filter((id) => id !== de)));
        } else if (mensaje.tipo === "empezar") {
          setCuenta(CUENTA_S);
        } else if (mensaje.tipo === "reloj") {
          // El pulso solo corrige si se nota; una orden (pausa, «voy por») siempre.
          if (mensaje.pulso && !hayQueCorregir(relojRef.current, mensaje.tiempo, mensaje.pausado, ahoraLocal())) return;
          fijar(relojEn(mensaje.tiempo, mensaje.pausado, ahoraLocal()));
        } else if (mensaje.tipo === "titulo" && de) {
          const nombre = miembrosRef.current.find((m) => m.id === de)?.nombre ?? "Alguien";
          setOtroTitulo(mensaje.titulo.ruta === tituloRef.current.ruta ? null : { ...mensaje.titulo, de: nombre });
        }
      },
    });
    canalRef.current = canal;
    return () => {
      canalRef.current = null;
      canal.cerrar();
      setMiembros([]);
      setListos([]);
      setConexion(null);
    };
  }, [activa, perfil, codigo, fijar]);

  // Cambiar de episodio en la ficha: se le cuenta a la sala.
  const rutaTitulo = titulo.ruta;
  const nombreTitulo = titulo.nombre;
  useEffect(() => {
    enviar({ tipo: "titulo", titulo: { ruta: rutaTitulo, nombre: nombreTitulo } });
  }, [rutaTitulo, nombreTitulo, enviar]);

  // --- Cuenta atrás: al acabar, el reloj echa a andar en todos -----------------
  useEffect(() => {
    if (cuenta === null) return undefined;
    const id = window.setTimeout(() => {
      if (cuenta > 1) setCuenta(cuenta - 1);
      else {
        setCuenta(null);
        // Desde donde estuviera: 0 la primera vez; tras una pausa, donde se paró.
        fijar(reanudarReloj(relojRef.current, ahoraLocal()));
        setListos([]);
      }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [cuenta, fijar]);

  // --- El segundero, y el pulso de quien dirige (quien llegó primero) ----------
  const corriendo = reloj.desde !== null;
  useEffect(() => {
    if (!corriendo) return undefined;
    const id = window.setInterval(() => setSegundos(Math.floor(leerReloj(relojRef.current, ahoraLocal()))), 1000);
    return () => window.clearInterval(id);
  }, [corriendo]);
  const dirijo = miembros[0]?.id === yo && Boolean(yo);
  useEffect(() => {
    if (!dirijo || !empezado) return undefined;
    const id = window.setInterval(() => contarReloj(true), PULSO_MS);
    return () => window.clearInterval(id);
  }, [dirijo, empezado, contarReloj]);

  // --- Lo que pulsa la persona ---------------------------------------------------
  const yoListo = listos.includes(yo);
  const marcarListo = useCallback(
    (listo: boolean) => {
      setListos((antes) => (listo ? [...new Set([...antes, yo])] : antes.filter((id) => id !== yo)));
      enviar({ tipo: "listo", listo });
    },
    [yo, enviar],
  );
  const empezar = useCallback(() => {
    enviar({ tipo: "empezar" });
    setCuenta(CUENTA_S);
  }, [enviar]);
  const pausarTodos = useCallback(() => {
    fijar(pausarReloj(relojRef.current, ahoraLocal()));
    contarReloj();
  }, [fijar, contarReloj]);
  const voyPor = useCallback(
    (tiempo: number) => {
      fijar(relojEn(tiempo, relojRef.current.desde === null, ahoraLocal()));
      contarReloj();
    },
    [fijar, contarReloj],
  );

  const estado: EstadoRelojSala = !activa ? "fuera" : conexion?.codigo === codigo ? conexion.estado : "conectando";
  return {
    estado,
    miembros,
    yo,
    listos,
    yoListo,
    todosListos: miembros.length > 1 && miembros.every((m) => listos.includes(m.id)),
    marcarListo,
    cuenta,
    /** «Empezar» la primera vez y «Seguir» tras una pausa: la misma cuenta atrás. */
    empezar,
    empezado,
    corriendo,
    segundos,
    pausarTodos,
    voyPor,
    otroTitulo,
  };
}
