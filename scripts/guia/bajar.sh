#!/usr/bin/env bash
# La guía diaria, de principio a fin. Lo corre `.github/workflows/guia.yml`, y
# se puede correr igual en local:
#
#   EPG=/ruta/al/clon/de/iptv-org/epg scripts/guia/bajar.sh publicar/guia.xml.gz
#
# Necesita el clon de iptv-org/epg con `npm ci` hecho. Tres rondas como mucho:
# en cada una, los canales que quedaron sin programas prueban otro sitio.
set -euo pipefail

SALIDA="${1:-publicar/guia.xml.gz}"
EPG="${EPG:?Falta EPG: la carpeta del clon de iptv-org/epg}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
TRABAJO="$(mktemp -d)"
RONDAS="${RONDAS:-3}"

# El lector de GatoTV con la hora arreglada, con el nombre que busca iptv-org.
mkdir -p "$EPG/sites/gatotv.com.canalcasa"
cp "$AQUI/gatotv.com.canalcasa.config.cjs" "$EPG/sites/gatotv.com.canalcasa/gatotv.com.canalcasa.config.js"

GUIAS=""
for ronda in $(seq 1 "$RONDAS"); do
  CANALES="$TRABAJO/canales-$ronda.channels.xml"
  if [ "$ronda" = 1 ]; then
    node "$AQUI/armar-canales.mjs" --epg "$EPG" --salida "$CANALES" --intentos "$TRABAJO/intentos.json"
  else
    node "$AQUI/armar-canales.mjs" --epg "$EPG" --salida "$CANALES" --intentos "$TRABAJO/intentos.json" --guias "$GUIAS"
  fi
  if ! grep -q "<channel " "$CANALES"; then
    echo "Ronda $ronda: no queda nada por probar."
    break
  fi
  # Despacio y con tope: son páginas de otros, una vez al día.
  (cd "$EPG" && npm run grab --silent -- --channels="$CANALES" --output="$TRABAJO/guia-$ronda.xml" \
    --days=2 --maxConnections=4 --timeout=20000) || echo "Ronda $ronda: el lector terminó con error; se sigue con lo que haya."
  if [ -f "$TRABAJO/guia-$ronda.xml" ]; then
    GUIAS="${GUIAS:+$GUIAS,}$TRABAJO/guia-$ronda.xml"
  fi
done

node "$AQUI/juntar-guias.mjs" ${GUIAS//,/ } --salida "$SALIDA"
