/**
 * El lector de GatoTV de iptv-org/epg, con la hora arreglada.
 *
 * El de iptv-org lee las horas de la página como si fueran de Nueva York
 * (`'EST'`, UTC-5). Pero cada página dice en qué hora las da (`utcOffset: -6`
 * en las de Guatemala), y para Guatemala todo salía una hora antes de lo que
 * se emite. Este envoltorio usa el lector de iptv-org tal cual y corre cada
 * programa lo que haga falta.
 *
 * La tarea diaria (`.github/workflows/guia.yml`) lo copia a
 * `sites/gatotv.com.canalcasa/gatotv.com.canalcasa.config.js` (el nombre que
 * busca iptv-org) dentro del clon de iptv-org/epg; de ahí el
 * `require` relativo. CommonJS, como los demás lectores de iptv-org.
 */
const path = require("path");

const ESTE_MS = -5 * 60 * 60 * 1000;

/** El desfase que declara la página, en milisegundos, o `null` si no lo dice. */
function desfaseDeLaPagina(contenido) {
  const match = /utcOffset:\s*(-?\d+(?:\.\d+)?)/.exec(String(contenido ?? ""));
  return match ? Number(match[1]) * 60 * 60 * 1000 : null;
}

/**
 * Cuánto hay que mover cada programa. Leído como -5 y emitido a -6: una hora
 * más tarde en UTC. Sin dato en la página no se toca nada.
 */
function correccionMs(contenido) {
  const desfase = desfaseDeLaPagina(contenido);
  return desfase === null ? 0 : ESTE_MS - desfase;
}

function cargarBase() {
  return require(path.join(__dirname, "..", "gatotv.com", "gatotv.com.config.js"));
}

function crear(base) {
  return {
    ...base,
    site: "gatotv.com.canalcasa",
    parser(contexto) {
      const programas = base.parser(contexto);
      const ms = correccionMs(contexto.content);
      if (!ms) return programas;
      return programas.map((p) => ({ ...p, start: p.start.add(ms, "millisecond"), stop: p.stop.add(ms, "millisecond") }));
    },
  };
}

// En las pruebas no hay clon de iptv-org al lado: se exportan solo las cuentas.
let modulo;
try {
  modulo = crear(cargarBase());
} catch {
  modulo = {};
}
modulo.desfaseDeLaPagina = desfaseDeLaPagina;
modulo.correccionMs = correccionMs;
modulo.crear = crear;
module.exports = modulo;
