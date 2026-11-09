# Vimeus y Ver juntos: qué se puede y qué no

Investigado el 2026-11-09 leyendo el código que sirve Vimeus (sin ejecutarlo)
y llamando a su API con la clave de la casa.

## Cómo está hecho su reproductor

```
CanalCasa ─ iframe ─▶ vimeus.net/e/movie   (envoltorio React: elige servidor)
                         └─ iframe ─▶ vimeos.net/embed-….html   (JWPlayer + anuncios)
```

- **El envoltorio** (`/player-assets/index-v2.js`) no escucha `message`. El
  único `postMessage` es el interno de React (`MessageChannel`). Lee de la URL
  solo estos ajustes: `theme` (vimeus, minimal, red, blue, purple, cosmic),
  `loader`, `font`, `selector`, `playUI`, `epanel`, `splash` (v1–v3),
  `overlay` (v1–v5) y `autoplay` (0/1). `logo_url` y `primary_color` **no
  aparecen** en su código. Servidores por orden: vimeos.net, goodstream.one,
  voe.sx.
- **El reproductor de dentro** (vimeos.net, JWPlayer, script empaquetado)
  tampoco escucha `message`. Hace lo contrario: **manda** su configuración al
  padre, pero solo si la página que lo contiene es `tv.la.movie` (un socio en
  lista blanca, por `document.referrer`). Además: guarda por dónde vas en su
  `localStorage` (7 días) y salta ahí al dar play; anuncios VAST al empezar y
  en el minuto 15; `pop.js`; `disable-devtool`.

**Conclusión: no hay sincronía real posible desde fuera.** No se puede leer el
minuto ni mandar play/pausa/salto. Lo único que lo daría es que Vimeus nos
pusiera en su lista blanca (como a `tv.la.movie`) o nos diera una API.

## Qué son `/cf/*`, `cf`, `pc`, `claim`, `play_claim`, `with_cf=true`

- `with_cf=true` en la API (`/api/listing/*`) filtra a lo que está en
  servidores con «CF Token» (`hosts_support_cf_token`) y cambia `embed_url` a
  `vimeus.net/cf/movie?…`. Con un `view_key` distinto al de `/e/`.
- `/cf/movie` **se salta el envoltorio**: redirige (307) directo a
  `vimeos.net/embed-….html?cf=…`, pasando `cf`, `pc`, `claim`, `play_claim`.
  Sin `cf` da 404 «No CF-compatible provider found».
- Con un `cf` inventado, vimeos.net responde «La sesión no es válida para este
  dispositivo o contenido · `invalid_cf_format`». O sea: **`cf` es un token de
  sesión firmado por aparato y título**, que el socio genera en su servidor.
  Es protección contra el robo de enlaces, no un mando. `claim`/`play_claim`
  parecen reclamar esa sesión (no documentado; es mi lectura).
- No se intentó adivinar el formato del token: sería saltarse su protección.
- La API también devuelve `download_url` (`/d/movie?…`). No se ha usado.

## Lo que sí se puede hacer: «sincronía suave»

La sala no controla el vídeo, pero sí lleva **el reloj**:

1. La sala manda el mismo título/episodio a todos (ya lo hace).
2. Cada uno abre el reproductor y pasa los anuncios **a su ritmo**; cuando ve
   la película en el minuto 0 pulsa **«Listo»**. (Los anuncios duran distinto
   en cada aparato: por eso la cuenta atrás no puede ir antes.)
3. Con todos listos: cuenta atrás 3·2·1 y cada uno da play.
4. Desde ahí la sala lleva un reloj compartido y lo enseña encima del
   reproductor: «Deberían ir por 12:34». **«Pausa para todos»** congela el
   reloj de todos (y cada uno pausa en su reproductor); **«Voy por…»** permite
   corregir el reloj de la sala si alguien se adelantó o atrasó.

Precisión esperable: ±2–3 s (lo que tarda una persona en pulsar). Suficiente
para reírse a la vez; no para un final con giro sorpresa.

## Mensaje para Vimeus (para mandarlo el dueño)

> Hola, soy socio con API key (cuenta CanalCasa). Uso su reproductor embebido
> en una app familiar para ver películas a la vez en varios aparatos.
>
> 1. ¿Su reproductor tiene una API de control para socios (por `postMessage`:
>    play, pausa, ir al segundo X, y eventos de tiempo)? Vi que vimeos.net ya
>    envía su configuración a `tv.la.movie`. ¿Podrían añadir mi dominio
>    (`…vercel.app`) y el de mi app de TV?
> 2. ¿Qué son `cf`, `pc`, `claim` y `play_claim` en las rutas `/cf/*`, y cómo
>    genera un socio el token `cf`?
> 3. ¿Tienen un plan sin anuncios o sin ventanas emergentes para socios?
> 4. En una app de Samsung Tizen (origen `file://`), ¿el reproductor acepta la
>    view key?
> 5. ¿Qué uso permiten de `download_url`?
>
> Gracias.
