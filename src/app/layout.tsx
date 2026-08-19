import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CanalCasa",
  description: "TV en vivo en casa: televisor, tablet o teléfono.",
};

/** App instalable y a pantalla completa; sin zoom accidental con el mando. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-input="pointer">
      <body>{children}</body>
    </html>
  );
}
