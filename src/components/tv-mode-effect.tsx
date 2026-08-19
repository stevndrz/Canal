"use client";

import { useEffect } from "react";

/**
 * Activa el modo TV en el elemento raíz.
 *
 * Ya no es una preferencia que el usuario elija: es un ajuste de rendimiento
 * —quita desenfoques y sombras grandes, que es lo primero que hace tirones en
 * la GPU de un televisor— y no algo que nadie deba tener que entender para usar
 * la app. Se decide por el tamaño de la pantalla, que es la señal disponible:
 * a partir de este ancho lo normal es estar frente a una TV, no a un monitor.
 *
 * Se aplica sobre `<html>` y no dentro de un contenedor porque el reproductor
 * puede estar en pantalla completa, fuera del árbol normal, y aun así debe
 * respetar el modo.
 */
const TV_MIN_WIDTH = 1280;

export function TvModeEffect() {
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${TV_MIN_WIDTH}px)`);
    const apply = () => document.documentElement.classList.toggle("tv-mode", query.matches);

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return null;
}
