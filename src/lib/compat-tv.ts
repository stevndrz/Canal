/**
 * Lo mínimo para que el JS arranque en los televisores de 2019 (Samsung
 * Tizen 5.0 = Chromium 63; LG webOS 4.x = Chromium 53).
 *
 * `browserslist` (package.json) ya hace que SWC reescriba la SINTAXIS nueva
 * (`?.`, `??`, campos de clase…). Lo que no puede reescribir son las cosas que
 * el código da por existentes, y la primera es `globalThis` (Chromium 71):
 * Turbopack envuelve CADA archivo en `(globalThis.TURBOPACK||…).push(…)`, así
 * que sin él no corre ni una línea — medido con un Chromium 63 real.
 *
 * ## La carrera, y por qué hay red de seguridad
 *
 * Este guion va en línea en `<head>`, pero React coloca antes las hojas de
 * estilo y los `<script async>` de Next. Un guion en línea **espera a que
 * terminen de cargar las hojas de estilo que tiene delante**; uno `async` no.
 * Así que en un televisor, el primer archivo de JS puede descargarse y
 * ejecutarse antes que esto, y fallar en `globalThis`.
 *
 * Se probó la alternativa obvia, `experimental.inlineCss` (sin hoja externa no
 * hay espera): funciona, pero el HTML de Inicio pasaba de 21 KB a 124 KB con
 * gzip en TODOS los aparatos, porque Next manda el CSS dos veces.
 *
 * Lo que se hace en cambio: si `globalThis` faltaba, se vuelve a insertar cada
 * archivo de `/_next/static/chunks/` que ya se había descargado y no llegó a
 * registrarse. Es seguro por dos motivos, comprobados en el runtime:
 *
 * - Un archivo que falló en `globalThis` falló en su PRIMERA expresión: no
 *   dejó nada a medias.
 * - Si por la carrera alguno se ejecuta dos veces, el runtime ignora los
 *   módulos ya registrados (`t.has(r) || t.set(r, …)`).
 *
 * En un navegador moderno `globalThis` existe y todo esto no hace nada.
 *
 * Solo se rellena lo que falta y lo que se ha visto hacer falta: cada línea
 * viaja en el HTML de todos los aparatos.
 */
const RED_DE_SEGURIDAD = `if(typeof globalThis==="undefined"){self.globalThis=self;(function(){
var hechos={},ruta=function(s){return String(s).split("?")[0];};
var anotar=function(e){var s=e&&e[0];var src=s&&s.getAttribute?s.getAttribute("src"):typeof s==="string"?s:null;if(src)hechos[ruta(src)]=1;};
var envolver=function(v){if(v&&typeof v.push==="function"){var p=v.push;v.push=function(e){anotar(e);return p.apply(this,arguments);};}return v;};
var actual=envolver([]);
Object.defineProperty(self,"TURBOPACK",{configurable:true,get:function(){return actual;},set:function(v){actual=envolver(v);}});
var p=document.querySelectorAll('script[src*="/_next/static/chunks/"]');
for(var i=0;i<p.length;i++){var src=p[i].getAttribute("src");
if(hechos[ruta(src)]||!performance.getEntriesByName(p[i].src).length)continue;
var n=document.createElement("script");n.src=src;n.async=true;document.head.appendChild(n);}
})();}`.replace(/\n/g, "");

export const GUION_COMPATIBILIDAD = [
  RED_DE_SEGURIDAD,
  // queueMicrotask (Chromium 71).
  `if(typeof queueMicrotask!=="function"){self.queueMicrotask=function(f){Promise.resolve().then(f);};}`,
  // Object.fromEntries (Chromium 73).
  `if(!Object.fromEntries){Object.fromEntries=function(i){var o={};Array.from(i,function(e){o[e[0]]=e[1];});return o;};}`,
  // Array.prototype.flat / flatMap (Chromium 69).
  `if(!Array.prototype.flat){Object.defineProperty(Array.prototype,"flat",{configurable:true,writable:true,value:function(d){d=d===undefined?1:Number(d);return d<1?Array.prototype.slice.call(this):Array.prototype.reduce.call(this,function(a,v){return a.concat(Array.isArray(v)?v.flat(d-1):v);},[]);}});}`,
  `if(!Array.prototype.flatMap){Object.defineProperty(Array.prototype,"flatMap",{configurable:true,writable:true,value:function(f,t){return Array.prototype.map.call(this,f,t).flat(1);}});}`,
  // Object.hasOwn (Chromium 93).
  `if(!Object.hasOwn){Object.hasOwn=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};}`,
  // String.prototype.replaceAll (Chromium 85).
  `if(!String.prototype.replaceAll){Object.defineProperty(String.prototype,"replaceAll",{configurable:true,writable:true,value:function(a,b){return typeof a==="string"?this.split(a).join(b):this.replace(a,b);}});}`,
].join("");
