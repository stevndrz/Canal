/**
 * Respaldo de `clamp()`, `min()` y `max()` para los televisores de 2019.
 *
 * Esas tres funciones son de Chromium 79. En una Samsung de 2019 (Chromium 63)
 * o una LG de 2019 (Chromium 53) una declaración que las usa es inválida y se
 * descarta entera: con 230 usos en las hojas, los márgenes, los radios y los
 * tamaños de letra caían a cero o al valor del navegador.
 *
 * Qué hace, sin tocar lo que ven los navegadores modernos: justo detrás de
 * cada regla afectada añade la misma regla con valores fijos, dentro de
 * `@supports not (clamp)`. Solo el navegador viejo la aplica; como va en el
 * mismo sitio y con el mismo selector, lo que venga después en la hoja la
 * sigue pisando igual que pisaba a la original.
 *
 * Por qué no el truco clásico de poner antes una copia con el valor fijo:
 * Lightning CSS (Turbopack) fusiona las declaraciones repetidas y se queda con
 * la última, así que la copia desaparecía del CSS servido. Y en las variables
 * (`--margen: clamp(…)`) tampoco serviría: una variable acepta cualquier
 * texto y el fallo llega tarde, al usarla.
 *
 * El valor fijo está pensado para una tele, que es quien lo va a usar: las
 * escalas de esta app crecen hasta 1920 px, así que de un `clamp(min, x, máx)`
 * se toma el máximo; de un `min()`, el término sin unidades de pantalla (el
 * tope fijo); de un `max()`, el que sí las lleva.
 */

const FUNCION = /(?<![\w-])(clamp|min|max)\(/i;
const DE_PANTALLA = /\d(vw|vh|vmin|vmax|%)/;
const SIN_CLAMP = "not (width: clamp(1px, 1px, 1px))";

/** Índice del paréntesis que cierra el que abre en `inicio`. */
function cierre(texto, inicio) {
  let nivel = 0;
  for (let i = inicio; i < texto.length; i += 1) {
    if (texto[i] === "(") nivel += 1;
    else if (texto[i] === ")") {
      nivel -= 1;
      if (nivel === 0) return i;
    }
  }
  return -1;
}

/** Separa por comas de primer nivel. */
function argumentos(texto) {
  const partes = [];
  let nivel = 0;
  let desde = 0;
  for (let i = 0; i < texto.length; i += 1) {
    if (texto[i] === "(") nivel += 1;
    else if (texto[i] === ")") nivel -= 1;
    else if (texto[i] === "," && nivel === 0) {
      partes.push(texto.slice(desde, i).trim());
      desde = i + 1;
    }
  }
  partes.push(texto.slice(desde).trim());
  return partes;
}

function elegir(nombre, args) {
  if (nombre === "clamp") return args[args.length - 1];
  if (nombre === "min") return args.find((a) => !DE_PANTALLA.test(a)) ?? args[args.length - 1];
  return args.find((a) => DE_PANTALLA.test(a)) ?? args[0];
}

/** El valor con cada `clamp/min/max` sustituido por un término fijo. */
function aproximar(valor) {
  let resultado = valor;
  for (let vueltas = 0; vueltas < 50; vueltas += 1) {
    const m = FUNCION.exec(resultado);
    if (!m) return resultado;
    const abre = m.index + m[0].length - 1;
    const cierra = cierre(resultado, abre);
    if (cierra < 0) return valor;
    const dentro = aproximar(resultado.slice(abre + 1, cierra));
    const elegido = elegir(m[1].toLowerCase(), argumentos(dentro));
    // Dentro de un `calc()` basta el término; suelto, también vale tal cual.
    resultado = resultado.slice(0, m.index) + elegido + resultado.slice(cierra + 1);
  }
  return resultado;
}

/*
 * Lo que NO hace falta aquí: separar las listas de selectores con
 * `:focus-visible` (Chromium 86). Lightning CSS ya lo hace solo según
 * `browserslist`. Se intentó hacerlo también aquí y fue peor: Lightning
 * fusionaba la copia con la original y desaparecía `:focus-visible` para
 * todos los navegadores.
 */

/** @type {import('postcss').PluginCreator<void>} */
module.exports = () => ({
  postcssPlugin: "respaldo-tv",
  OnceExit(root, { AtRule, Rule }) {
    const variablesPorRegla = new Map();
    root.walkDecls((decl) => {
      if (!FUNCION.test(decl.value)) return;
      const fijo = aproximar(decl.value);
      if (fijo === decl.value || FUNCION.test(fijo)) return;
      const regla = decl.parent;
      if (!regla || regla.type !== "rule") return;
      // Ya dentro de un @supports de este plugin: no se repite.
      if (regla.parent && regla.parent.type === "atrule" && regla.parent.params === SIN_CLAMP) return;
      if (!variablesPorRegla.has(regla)) variablesPorRegla.set(regla, []);
      variablesPorRegla.get(regla).push({ prop: decl.prop, value: fijo, important: decl.important });
    });
    for (const [regla, variables] of variablesPorRegla) {
      const soporte = new AtRule({ name: "supports", params: SIN_CLAMP });
      const copia = new Rule({ selector: regla.selector });
      for (const v of variables) copia.append({ prop: v.prop, value: v.value, important: v.important });
      soporte.append(copia);
      regla.after(soporte);
    }
  },
});
module.exports.postcss = true;
module.exports.aproximar = aproximar;
