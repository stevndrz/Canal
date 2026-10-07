import { EsqueletoFicha } from "@/components/catalog/esqueleto-ficha";

/**
 * Lo que se ve al pulsar una carátula, desde el primer fotograma.
 *
 * Next prefetchea este respaldo, así que la respuesta al toque es inmediata;
 * hasta ahora no existía y el hueco era una pantalla negra. Ver
 * `esqueleto-ficha.tsx`.
 */
export default function CargandoFicha() {
  return <EsqueletoFicha />;
}
