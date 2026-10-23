# Seguridad

Lo que este proyecto protege, lo que ha decidido **no** proteger, y por qué.

La segunda lista es la que importa. Una aplicación sin riesgos no existe; lo que
distingue a una cuidada es que sepa cuáles corre y los haya elegido. Todo lo de
aquí abajo es una decisión, no un descuido — y cada una lleva su evidencia, para
que quien la quiera reabrir sepa contra qué discute.

Quien busque cómo está montada la app, eso está en `ARQUITECTURA.md`.

---

## Con qué se cuenta

- **No hay cuentas, ni sesiones, ni datos personales.** No hay contraseñas que
  robar ni perfiles que filtrar. Lo que sí hay que cuidar es lo del despliegue:
  la credencial de TMDB, la cuota de la API y la factura de Vercel.
- **`localStorage` guarda solo ids, ajustes y enlaces que la persona pegó.**
  Nada cifrable, nada que valga fuera de ese aparato.
- **El repositorio es público.** Todo lo que se escriba en el código se publica,
  incluido el historial.

## Lo que sí está puesto

| Control | Dónde |
|---|---|
| Cabeceras de seguridad (HSTS, `nosniff`, `frame-ancestors`, Referrer, Permissions, COOP) | `next.config.ts` |
| CSP cerrada del todo en las rutas de API | `next.config.ts` → `CABECERAS_API` |
| Freno de peticiones por IP **y** tope global no falsificable | `src/lib/limite-peticiones.ts` |
| Credenciales fuera de los registros | `src/lib/url-segura.ts` |
| Frontera cliente/servidor que falla al compilar | `src/lib/config.server.ts`, `import "server-only"` |
| Comprobación de esquema en toda URL que viene de fuera | `m3u.ts`, `stremio.ts`, `providers.ts`, `fuente-propia/url.ts` |
| Guía EPG de la lista: solo `https` y nunca a la red interna | `src/lib/epg.ts` |
| Topes de tamaño y de tiempo en toda descarga remota | `m3u.ts`, `epg.ts`, `tmdb.ts`, `disponibilidad.ts` |
| La sonda solo sale a URLs que están en la lista de canales | `src/app/api/salud/route.ts` |
| `next` con piso en la versión sin los avisos críticos (16.4.3) | `package.json` |
| Token de GitHub Actions en solo lectura; entradas a mano por `env`, validadas | `.github/workflows/` |

---

## Riesgos aceptados

### 1. Los iframes de proveedores van sin `sandbox`

**El riesgo.** Los guiones de publicidad que viven dentro del marco de un
proveedor pueden, tras un gesto de la persona, navegar la ventana entera a otro
sitio. En una app que la familia abre a diario, eso es una vía de suplantación.

**Por qué se acepta.** Se puso `sandbox` y se retiró, con el motivo escrito en
`ficha-reproductor.tsx`: *«Lo único que consiguió fue que los proveedores lo
detectaran y se negaran a reproducir ("iframe sandbox detected")»*. Y no arregla
lo que se buscaba: el bucle de recargas vive en un marco anidado que se recarga a
sí mismo, cosa que el sandbox permite igual (ver `reproduccion/marco-en-bucle.ts`).
Además, los permisos que estos reproductores necesitan —`allow-scripts` junto con
`allow-same-origin`— dejan al marco quitarse el sandbox solo, así que la versión
que sí funcionaría tampoco protegería gran cosa.

**Qué se hace en su lugar.** El marco arranca con `tabIndex={-1}`: el mando no
puede entrar hasta que alguien pulsa «Usar los controles del servidor». Sin gesto
dentro del marco, el navegador ya bloquea `window.open` por su cuenta, y el
permiso se reinicia al cambiar de servidor.

### 2. `/api/canales` reparte las URLs de emisión a quien las pida

**El riesgo.** La respuesta es pública y se cachea cinco minutos en el borde. Con
la lista por defecto —un Gist público— no hay nada que proteger. Pero **las
listas IPTV de pago meten la credencial dentro de cada URL de emisión**
(`http://portal/live/usuario/clave/123.ts`), así que apuntar `M3U_URL` a una
lista de pago convierte el despliegue en un repartidor público de esa
suscripción.

**Por qué se acepta.** No tiene arreglo técnico: el navegador necesita esa URL
para reproducir, así que cualquiera que abra la app la tiene. Lo único que lo
cerraría es poner una puerta de acceso a la aplicación, y se decidió que no —
esta app tiene que abrirse sin fricción en el teléfono de cualquiera de la casa.

**Qué se hace en su lugar.** Decirlo donde se lee: hay un aviso junto a `M3U_URL`
en el README. **Si usas una lista de pago, no despliegues esto en una URL
pública.**

### 3. La CSP no lleva `script-src`

**El riesgo.** Si algún día entrara un XSS, no habría nada que limitara lo que
puede ejecutar.

**Por qué se acepta.** Un `nonce` por petición **obliga a render dinámico** y es
incompatible con `cacheComponents`, que es justo lo que hace que el armazón
aparezca al instante en un televisor. La documentación de Next lo dice sin
rodeos: *«Partial Prerendering (PPR) is incompatible with nonce-based CSP since
static shell scripts won't have access to the nonce»*. Escribir esa CSP cuesta
la optimización que más se nota desde el sofá, y poner `'unsafe-inline'` para
salir del paso sería escribir la palabra CSP sin obtener su protección.

**Qué se hace en su lugar.** Mantener la superficie en cero: no hay
`innerHTML`, ni `eval`, ni HTML de fuera en ningún punto de la app —los dos
`dangerouslySetInnerHTML` de `layout.tsx` llevan constantes escritas en el
código, nunca datos—, y toda URL que llega de fuera pasa por una comprobación de
esquema. Donde la CSP sí se puede cerrar sin pagar nada —las rutas de API— está
cerrada. **Si alguna vez se añade HTML de terceros a la interfaz, esta decisión
hay que rehacerla.**

### 4. El freno de peticiones vive en memoria del proceso

**El riesgo.** Cada instancia de la función tiene su propio contador, así que con
varias instancias el tope efectivo se multiplica.

**Por qué se acepta.** Es lo que se puede hacer sin base de datos, que es un
pilar declarado del proyecto. Convierte «te vacían la cuota de TMDB en un bucle»
en «te hacen cosquillas», y eso ya vale la pena.

**Qué se hace en su lugar.** Un tope global que no depende de quién llame, así
que falsificar `x-forwarded-for` ya no lo esquiva (`limite-peticiones.ts`), más
topes en el tamaño del espacio de claves de `/api/stream` para que nadie pueda
provocar peticiones salientes a voluntad. **Para algo serio, el WAF de Vercel, que
no necesita código.**

### 5. `CLAVE_VIMEUS` viaja en el paquete del navegador

Está en `catalog/providers.ts`, que importa un componente de cliente, así que
acaba en el JavaScript que se descarga. **No es un descuido y no es un secreto**:
es la clave pública del generador de embeds de Vimeus, la misma que publican
todos los sitios que lo usan.

Lo que sí importa: ese archivo cruza al navegador. **No se puede añadir ahí nada
que no sea público.** Si algún día hace falta un proveedor con credencial de
verdad, su URL tiene que construirse en el servidor y salir por `/api/stream`,
que es justo para lo que existe esa ruta.

### 6. `frame-src` sin lista blanca

**El riesgo.** Si entrara un fallo que dejara meter un `<iframe>`, podría
apuntar a cualquier sitio.

**Por qué se acepta.** Los servidores de cine son cuatro y están escritos en
`providers.ts`, así que la lista parecía fácil de sacar de ahí. Pero `frame-src`
se comprueba **también en cada redirección**, y los proveedores redirigen:
comprobado el 23-oct-2026, `multiembed.mov` manda a `streamingnow.mov`, un
dominio que no aparece en ningún sitio del código. Con la lista sacada de
`providers.ts` ese servidor habría quedado en blanco sin mensaje de error, y la
próxima rotación haría lo mismo con otro. La protección que da sin `script-src`
es pequeña; lo que rompe se ve desde el sofá.

**Qué se hace en su lugar.** Lo mismo que en el riesgo 3: no hay ningún punto
donde datos de fuera acaben siendo HTML. **Si se reabre, la lista tiene que
salir de seguir las redirecciones de cada proveedor, no de sus plantillas.**

---

## Lo que hay que hacer y no es código

- **Activar el escaneo de secretos y la protección al empujar** (Settings →
  Code security → *Secret scanning* y *Push protection*; gratis en
  repositorios públicos). Con eso GitHub **rechaza el `git push`** que lleve
  un token, que es lo que habría evitado lo del token de TMDB. Y de paso las
  **alertas de Dependabot**, que siguen apagadas (ver
  `docs/equipo/config-seguridad.md`).
- **Bots y abuso: el firewall de Vercel**, no código. Una regla de límite por
  IP en `/api/*` (Firewall → Rate limiting) cuenta en el borde y entre todas
  las instancias, que es justo lo que el freno en memoria no puede (riesgo 4).

- ✅ **Token de TMDB rotado** (31-ago-2026). Hubo uno escrito en el código
  como reserva que quedó en el historial de Git, público: quitarlo del código
  no lo desactivaba. Se regeneró en themoviedb.org y se cargó en Vercel como
  `TMDB_API_KEY`. El viejo sigue legible en el historial —reescribirlo no
  habría servido, los clones y forks ya lo tenían— pero ahora es irrelevante.
- **No apuntar `M3U_URL` a una lista de pago** en un despliegue público. Ver el
  riesgo 2.
- **Revisar los avisos de Dependabot.** El CI corre `npm audit` en cada cambio,
  pero avisa de lo que ya está; Dependabot es lo que trae el arreglo.

---

## Si encuentras algo

Esto es la televisión de una casa, no un banco: no hay programa de recompensas
ni buzón cifrado. Abre una incidencia en el repositorio. Si lo que encuentras
afecta a una credencial, dilo **sin pegarla** en el texto.
