import { NextResponse, type NextRequest } from "next/server";
import { publicConfig } from "@/lib/config";

/**
 * No exporta `dynamic` ni `runtime`: con `cacheComponents` activo (ver
 * `next.config.ts`) esas dos directivas están reñidas con el build de
 * Turbopack. El proxy ya hace `fetch` con `cache: "no-store"` implícito
 * al no tener caché compartida, y corre en el runtime por defecto.
 */

const VIMEUS_BASE = "https://vimeus.com";
const VIMEUS_REFERER = "https://vimeus.com/";
const VIMEUS_VIEW_KEY = "mIO3kPK2Jk3hiOdw1bzXPDYYWvf-IgblslyRhziDhw";

const ORIGEN_PROPIO = publicConfig.sitioUrl;

/**
 * Scripts del embed que son anuncios o los sirven. Se quitan del HTML antes
 * de entregarlo para que JWPlayer arranque sin preroll ni popunders.
 *
 * Coincide por nombre de archivo en cualquier subdirectorio: `pop.js` (el que
 * dispara los popunders) y `vast.js` (el inyector de preroll VAST) son los
 * dos confirmados por DevTools.
 */
const SCRIPTS_DE_ANUNCIOS = /(^|\/)(pop|vast|ads|prebid)\.js(\?|$)/i;

const UA_NAVEGADOR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Bloquea los `<script src="…/pop.js">` y similares, dejando un comentario en
 * su lugar. El resto de atributos del `<script>` se conservan para no
 * desordenar el DOM que espera JWPlayer.
 */
function neutralizarScripts(html: string): string {
  return html.replace(
    /<script\b([^>]*)>\s*<\/script>/gi,
    (match, attrs: string) => {
      const srcMatch = attrs.match(/\ssrc=("([^"]*)"|'([^']*)')/i);
      if (!srcMatch) return match;
      const url = (srcMatch[2] ?? srcMatch[3] ?? "").trim();
      if (!url) return match;
      if (SCRIPTS_DE_ANUNCIOS.test(url)) {
        return `<script${attrs.replace(/\ssrc=("[^"]*"|'[^']*')/i, "")}>/* bloqueado por proxy: ${url} */</script>`;
      }
      return match;
    }
  );
}

/**
 * Reescribe las URLs ABSOLUTAS a `vimeos.net` para que pasen por nuestro
 * proxy de assets (`/api/proxy/vimeos-asset`). Esto es necesario porque
 * Cloudflare valida el `Referer`: si el iframe carga el HTML desde nuestro
 * origen, las requests de JWPlayer/XHR/fetch a `vimeos.net` salen con
 * `Referer: https://tudominio.com` y caen en 403.
 *
 * Solo se aplica cuando hay `NEXT_PUBLIC_SITIO_URL` configurado. Sin esa
 * variable no hay a dónde apuntar el proxy de assets y el rewrite se omite:
 * el HTML sale con las URLs originales y las requests van directo a
 * vimeos.net — mismo comportamiento que antes del proxy, pero con los
 * scripts de ads ya neutralizados.
 */
/**
 * El popunder de verdad: no es `pop.js` con nombre fijo, es CUALQUIER script
 * —con el nombre que sea, inyectado o inline— que llame a `window.open()`. Es
 * lo que dejaba pasar `neutralizarScripts`, que solo mira nombres de archivo
 * conocidos, y lo que hizo que un dominio nuevo (`maicoldr.lol`, no visto
 * antes) se colara: en una WebView de televisor sin gestor de pestañas, esa
 * llamada no abre nada — la propia página intenta navegar ahí y el dominio
 * rechaza la conexión, tapando la película entera.
 *
 * `Object.defineProperty` con `writable: false` en vez de una asignación
 * simple: una asignación (`window.open = fn`) la puede pisar el propio script
 * de anuncios reasignándola otra vez; con el descriptor congelado, no puede.
 *
 * Va SIEMPRE, tenga o no `NEXT_PUBLIC_SITIO_URL` configurado — a diferencia
 * del reescrito de assets de más abajo, que si necesita esa variable.
 */
const BLOQUEO_POPUPS = `
<script>
(function(){
  try {
    Object.defineProperty(window, "open", {
      value: function () { return null; },
      writable: false,
      configurable: false,
    });
  } catch (e) {
    window.open = function () { return null; };
  }
})();
</script>`;

function inyectarProxyDeAssets(html: string): string {
  if (!ORIGEN_PROPIO) return html.replace(/<head>/i, `<head>${BLOQUEO_POPUPS}`);

  const script = `
<script>
(function(){
  // Proxy: enviar las requests de assets a /api/proxy/vimeos-asset para que
  // el Referer siga siendo de vimeus y Cloudflare no devuelva 403. Se hace
  // en runtime porque el HTML viene con URLs absolutas a vimeos.net
  // hardcodeadas y no se pueden reescribir en servidor sin romper JWPlayer.
  var ORIGEN = ${JSON.stringify(ORIGEN_PROPIO)};
  var PROXY = ORIGEN + '/api/proxy/vimeos-asset?u=';
  var HOSTS = ['vimeos.net', 'vimeus.com', 'lamovie.link'];
  function esHost(url){
    try {
      var h = new URL(url, location.href).hostname.toLowerCase();
      return HOSTS.some(function(p){ return h === p || h.endsWith('.' + p); });
    } catch(e) { return false; }
  }
  function reescribir(url){
    if (typeof url !== 'string') return url;
    if (url.indexOf(ORIGEN) === 0) return url;
    if (!esHost(url)) return url;
    return PROXY + encodeURIComponent(url);
  }
  function reescribirAtributo(el, attr){
    var u = el.getAttribute(attr);
    if (!u) return;
    var r = reescribir(u);
    if (r !== u) el.setAttribute(attr, r);
  }
  function aplicar(){
    document.querySelectorAll('script[src], link[href], img[src], source[src], video[src], audio[src], iframe[src]').forEach(function(el){
      ['src','href'].forEach(function(a){ reescribirAtributo(el, a); });
    });
  }
  var observer = new MutationObserver(function(muts){
    muts.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if (n.nodeType !== 1) return;
        ['src','href'].forEach(function(a){ reescribirAtributo(n, a); });
        if (n.querySelectorAll) {
          n.querySelectorAll('script[src], link[href], img[src], source[src], video[src], audio[src], iframe[src]').forEach(function(el){
            ['src','href'].forEach(function(a){ reescribirAtributo(el, a); });
          });
        }
      });
    });
  });
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', aplicar);

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url){
    arguments[1] = reescribir(url);
    return origOpen.apply(this, arguments);
  };
  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function(input, init){
      if (typeof input === 'string') {
        input = reescribir(input);
      } else if (input && input.url) {
        var r = reescribir(input.url);
        if (r !== input.url) input = new Request(r, input);
      }
      return origFetch.call(this, input, init);
    };
  }
})();
</script>`;

  const estilosAntianuncios = `
<style>
/* Proxy: ocultar cualquier contenedor de anuncios que se cuele por inline. */
.jwplayer .jw-icon-ads,
.jwplayer .jw-icon-ad,
.jwplayer .jw-flag-ads,
.jwplayer .jw-flag-ad,
.jwplayer.jw-flag-ads,
.jwplayer.jw-flag-ad,
.ima-ad-container,
.ima-ad-div,
div[id^="google_ads_"],
div[id^="ad-"]:not([id^="adaptive"]):not([id^="address"]) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  height: 0 !important;
  width: 0 !important;
  position: absolute !important;
  left: -99999px !important;
}
body { background: #000 !important; }
</style>`;

  return html.replace(/<head>/i, `<head>${estilosAntianuncios}${BLOQUEO_POPUPS}${script}`);
}

export async function GET(request: NextRequest): Promise<Response> {
  const tmdbIdRaw = request.nextUrl.searchParams.get("tmdb");
  const tmdbId = Number(tmdbIdRaw);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "tmdb inválido" }, { status: 400 });
  }

  const destino = `${VIMEUS_BASE}/e/movie?tmdb=${tmdbId}&view_key=${VIMEUS_VIEW_KEY}&autoplay=1`;

  const soloEstado = request.nextUrl.searchParams.get("check") === "1";

  let upstream: Response;
  try {
    upstream = await fetch(destino, {
      headers: {
        "User-Agent": UA_NAVEGADOR,
        Referer: VIMEUS_REFERER,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream no responde", detalle: String(error) },
      { status: 502 }
    );
  }

  if (soloEstado) {
    // `disponibilidad.ts` se basa SOLO en el estado HTTP (404 = no lo tiene).
    // Devolvemos el mismo estado sin procesar el cuerpo para no malgastar
    // ancho de banda en cada ficha que alguien abra.
    await upstream.body?.cancel();
    return new NextResponse(null, {
      status: upstream.status,
      headers: {
        "Cache-Control": "no-store",
        "X-Proxy-Vimeus": "check",
      },
    });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `upstream ${upstream.status}`, destino },
      { status: upstream.status }
    );
  }

  const html = await upstream.text();
  const sinAnuncios = neutralizarScripts(html);
  const conProxy = inyectarProxyDeAssets(sinAnuncios);

  return new NextResponse(conProxy, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Proxy-Vimeus": "1",
    },
  });
}