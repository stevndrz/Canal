"use client";

import { useDetectarInput } from "@/hooks/use-detectar-input";

/**
 * Marca `<html data-input>` como "dpad" o "pointer" según el dispositivo de
 * entrada. Ver `use-detectar-input.ts`.
 *
 * Envuelto en su propio componente cliente porque `RootLayout` es un
 * componente de servidor: un hook no puede llamarse ahí directamente.
 */
export function DetectorInput() {
  useDetectarInput();
  return null;
}
