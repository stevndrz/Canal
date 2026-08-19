import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { TvModeEffect } from "@/components/tv-mode-effect";
import "./globals.css";

export const metadata: Metadata = {
  title: "CanalCasa · Televisión para tu hogar",
  description: "Canales en vivo, películas y series para las pantallas de tu familia.",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  // Evita el zoom accidental al tocar controles del reproductor en el teléfono.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        <TvModeEffect />
        {children}
      </body>
    </html>
  );
}
