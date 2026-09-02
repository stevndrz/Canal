import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { DetectorInput } from "@/components/detector-input";
import { SoporteHuecos } from "@/components/soporte-huecos";
import "./globals.css";

/**
 * Inter es la tipografía del lenguaje visual de CanalCasa.
 *
 * Detalle que hay que cuidar: declararla en `font-family` no basta — sin
 * `@font-face` o un enlace a Google Fonts solo se ve en equipos que ya la
 * tengan instalada. Aquí se carga de verdad y se autoaloja, que además evita
 * la petición a un tercero.
 *
 * Se expone como variable CSS en vez de como clase para que `--font-sans`
 * pueda encadenarla con los respaldos del sistema: si la fuente tarda o falla,
 * el texto sigue leyéndose con la del dispositivo.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CanalCasa",
  description: "TV en vivo en casa: televisor, tablet o teléfono.",
  // Añadida a la pantalla de inicio de un iPhone, la app abre sin la barra de
  // Safari. Sin esto se pierden 120px de alto y la barra inferior queda tapada.
  appleWebApp: {
    capable: true,
    title: "CanalCasa",
    statusBarStyle: "black-translucent",
  },
};

/**
 * App instalable y a pantalla completa.
 *
 * **El zoom se queda habilitado.** Antes había `maximumScale: 1` y
 * `userScalable: false` «para que el mando no hiciera zoom sin querer», y eso
 * era resolver un problema que no existe —un mando no hace pellizco— a cambio
 * de uno que sí: en el teléfono impedía ampliar la pantalla a quien lo
 * necesita para leer. Un televisor ignora estas dos claves de todas formas.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
  colorScheme: "dark",
  /**
   * Sin `viewportFit: "cover"`, `env(safe-area-inset-*)` vale siempre 0 en iOS.
   * La barra inferior del teléfono usa ese hueco para apartarse del indicador
   * de inicio del iPhone; sin él queda justo debajo y los últimos destinos son
   * casi imposibles de pulsar.
   */
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-input="pointer" className={inter.variable}>
      <body>
        {/* Antes que nada: en los navegadores de televisor el `gap` de flexbox
            no existe y todos los huecos de la app valen cero. Ver
            `soporte-gap.ts`. No pinta nada. */}
        <SoporteHuecos />
        <DetectorInput />
        {children}
      </body>
    </html>
  );
}
