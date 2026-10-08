import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SoporteHuecos } from "@/components/soporte-huecos";
import { GUION_ARRANQUE_PANTALLA } from "@/lib/tamano-texto";
import { GUION_COMPATIBILIDAD } from "@/lib/compat-tv";
import "./globals.css";

/**
 * Inter es la tipografía de CanalCasa.
 *
 * Volvió en octubre de 2026 por decisión del dueño: es la del diseño de Figma
 * que eligió para toda la app («Static Search Page»). Antes fue Figtree, que
 * se había preferido a Inter por ser menos genérica; con el lenguaje sobrio
 * del Figma, Inter encaja mejor y su interletrado negativo no junta palabras.
 *
 * Detalle que hay que cuidar: declararla en `font-family` no basta — sin
 * `@font-face` solo se ve en equipos que ya la tengan instalada. `next/font`
 * la descarga al compilar y la sirve desde el propio dominio: sin petición a
 * Google en cada visita (más rápido, y la CSP no tiene que abrirle la puerta).
 *
 * Se expone como variable CSS para que `--font-sans` pueda encadenarla con
 * los respaldos del sistema: si la fuente tarda o falla, el texto sigue
 * leyéndose con la del dispositivo.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * JetBrains Mono es la tipografía de instrumento: solo para números y
 * etiquetas de estado del reproductor (T+, bitrate, el contador de "Mi
 * enlace"...). el reproductor ya hablaba en lenguaje de sala de control
 * ("T+", `tabular-nums`); esto le pone la letra que ese lenguaje pedía.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
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
  // Safari en iPhone subraya con puntos lo que cree que es una dirección, un
  // teléfono o una fecha: «Guatemala» en el rótulo del canal y hasta el título
  // «Casa» salían subrayados, como si fueran enlaces. En una app de tele no
  // hay nada de eso que marcar.
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
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
  themeColor: "#0b0b0d",
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
    // `suppressHydrationWarning`: el guion de abajo añade `data-pantalla` y
    // `data-texto` antes de que React hidrate, y es a propósito.
    <html
      lang="es"
      data-input="pointer"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Primero de todo: sin `globalThis` no corre ningún archivo de JS en
            las teles de 2019. Ver `compat-tv.ts`. */}
        <script dangerouslySetInnerHTML={{ __html: GUION_COMPATIBILIDAD }} />
        {/* Televisor y tamaño de texto, antes del primer pintado. Ver
            `tamano-texto.ts`. */}
        <script dangerouslySetInnerHTML={{ __html: GUION_ARRANQUE_PANTALLA }} />
      </head>
      <body>
        {/* Antes que nada: en los navegadores de televisor el `gap` de flexbox
            no existe y todos los huecos de la app valen cero. Ver
            `soporte-gap.ts`. No pinta nada. */}
        <SoporteHuecos />
        {children}
        {/* Web Vitals de campo + los eventos de `telemetria.ts`. Vercel las
            sirve desde el edge de forma diferida: no compiten con el arranque. */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
