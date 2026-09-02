"use client";

import { useEffect, useState } from "react";

/**
 * Hook de monitoreo de ancho de banda de red.
 *
 * Usa la Network Information API cuando esté disponible (Chrome, Opera,
 * Edge, Android) y fallback a una estimación conservadora en otros navegadores.
 *
 * En televisores y displays inteligentes el API a veces no está disponible o
 * reporta valores nulos, por eso incluye una estimación por defecto segura.
 *
 * Exporta tanto el estado actual como funciones para forzar/consultar la calidad.
 */

export interface CalidadRed {
  /** "baja" | "media" | "alta" - calidad recomendada para el stream actual */
  calidad: "baja" | "media" | "alta";
  /** KB/s estimados actuales */
  kbps: number;
  /** ¿El API de Network Information está soportado? */
  soportado: boolean;
  /** ¿Hay suficiente ancho de banda para HLS de alta calidad? */
  suficienteParaAlta: boolean;
}

/**
 * Estados de calidad y sus umbrales en KB/s.
 *
 * Estos valores son orientativos y pueden ajustarse según la observación
 * real en distintos dispositivos y redes.
 */
const UMBRALES: Record<"baja" | "media" | "alta", { min: number; max: number }> = {
  baja: { min: 0, max: 1500 },
  media: { min: 1500, max: 3000 },
  alta: { min: 3000, max: Infinity },
};

/**
 * Determina la calidad recomendada basándose en el ancho de banda en KB/s.
 */
function determinarCalidad(kbps: number): "baja" | "media" | "alta" {
  if (kbps >= UMBRALA.min) return "alta";
  if (kbps >= UMBRALM.min) return "media";
  return "baja";
}

const UMBRALA = UMBRALES.alta;
const UMBRALM = UMBRALES.media;

/**
 * Obtiene el ancho de banda estimado en KB/s.
 *
 * Usa la Network Information API (`navigator.connection.downlink` en Mbps)
 * y lo convierte a KB/s (1 Mbps = 125 KB/s). Hace un fallback conservador.
 */
interface ConexionRed extends EventTarget {
  downlink?: number;
}

function obtenerConexion(): ConexionRed | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as unknown as { connection?: ConexionRed }).connection;
}

function obtenerAnchoBandwidthKBps(): number {
  const connection = obtenerConexion();

  // Network Information API disponible
  if (connection?.downlink) {
    // downlink viene en Mbps, convertimos a KB/s (1 Mbps = 1024/8 ≈ 128 KB/s)
    // Usamos 125 para redondeo conservador
    const kbps = connection.downlink * 125;
    return Math.max(kbps, 0);
  }

  // Fallback: estimación conservadora para televisores/devices sin API
  // Asumimos una conexión decente pero no excepcional
  return 2000; // 2 Mbps ≈ 250 KB/s, pero usamos más para no ser demasiado conservador
}

/** Punto de corte entre "alta" y "media" calidad: 3000 KB/s ≈ 2.4 Mbps */
export const UMBRAL_ALTA_KBPS = 3000;
/** Punto de corte entre "media" y "baja" calidad: 1500 KB/s ≈ 1.2 Mbps */
export const UMBRAL_MEDIA_KBPS = 1500;

/**
 * Monitorea el ancho de banda de red y devuelve la calidad recomendada.
 *
 * En dispositivos sin Network Information API (algunos televisores, navegadores
 * antiguos), usa un valor por defecto conservado de 2000 KB/s, lo cual suele
 * ser suficiente para HLS a calidad media-alta.
 *
 * El hook se actualiza cada 30 segundos o cuando el API reporta un cambio,
 * lo que evita despertar el dispositivo cada segundo en televisores.
 */
export function useCalidadRed(): CalidadRed {
  const [calidad, setCalidad] = useState<"baja" | "media" | "alta">("media");
  const [kbps, setKbps] = useState<number>(obtenerAnchoBandwidthKBps());
  const [soportado, setSoportado] = useState<boolean>(false);

  useEffect(() => {
    // Actualización inicial
    const kbpsInicial = obtenerAnchoBandwidthKBps();
    const connection = obtenerConexion();
    // La Network Information API no existe en el render de servidor, así
    // que la lectura real solo puede ocurrir después del montaje.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKbps(kbpsInicial);
    setSoportado(!!connection);
    setCalidad(determinarCalidad(kbpsInicial));

    // Si el API está soportado, escuchar cambios
    let cancelado = false;

    if (connection) {
      const actualizar = () => {
        if (cancelado) return;
        const nuevoKbps = obtenerAnchoBandwidthKBps();
        setKbps(nuevoKbps);
        setCalidad(determinarCalidad(nuevoKbps));
      };

      // Escuchar cambios de ancho de banda
      // El evento 'change' se dispara cuando el modem/red informa un cambio
      connection.addEventListener("change", actualizar);

      // También hacer polling cada 30 segundos como respaldo (importante en TVs)
      const intervalo = setInterval(actualizar, 30_000);

      return () => {
        cancelado = true;
        connection.removeEventListener("change", actualizar);
        clearInterval(intervalo);
      };
    }

    // Si no hay API, hacer polling conservativo cada 60 segundos
    const intervaloNoSoporte = setInterval(() => {
      if (cancelado) return;
      const nuevoKbps = obtenerAnchoBandwidthKBps();
      setKbps(nuevoKbps);
      setCalidad(determinarCalidad(nuevoKbps));
    }, 60_000);

    return () => {
      cancelado = true;
      clearInterval(intervaloNoSoporte);
    };
  }, [soportado]);

  const suficienteParaAlta = kbps >= UMBRAL_ALTA_KBPS;

  return {
    calidad,
    kbps,
    soportado,
    suficienteParaAlta,
  };
}