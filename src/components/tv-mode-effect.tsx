"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/use-app-store";

/**
 * Aplica las preferencias de imagen al elemento raíz.
 *
 * Se hace sobre `<html>` y no dentro de un contenedor porque el reproductor
 * puede estar en pantalla completa (fuera del árbol normal) y aun así debe
 * respetar el modo TV y la nitidez elegida.
 */
export function TvModeEffect() {
  const tvMode = useAppStore((state) => state.tvMode);
  const sharpness = useAppStore((state) => state.sharpness);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("tv-mode", tvMode);
    root.classList.toggle("sharpen", sharpness === "sharp");
  }, [tvMode, sharpness]);

  return null;
}
