# Memoria de `catalogo`

**Lo primero que hago al empezar es leer este archivo. Lo último, actualizarlo.**

Mi definición está en `.claude/agents/catalogo.md`; ahí van las reglas. Aquí va
lo que ha pasado.

---

## Mi zona

```
src/app/peliculas/ · src/app/api/buscar/
src/components/catalog/ · views/fuente-view.tsx · native-player.tsx
src/lib/catalog/ · lib/fuente-propia/
src/hooks/use-buscar-titulos.ts · use-fuentes.ts
```

**No toco:** nada de `livetv/`, `m3u.ts`, `epg.ts`, ni el CSS.

---

## Decisiones tomadas

- **La credencial de TMDB no sale al navegador.** Por eso la búsqueda pasa por
  `/api/buscar`.
- **Nada se almacena.** Cada página se pide al navegar y se descarta al salir.
- **TMDB rechaza páginas por encima de 500** aunque diga que hay miles.
- **El cambio de servidor lo hace la persona.** El iframe es de otro dominio:
  no se puede saber si cargó ni en qué idioma está.
- **`catalog.json` vacío**, todo de TMDB. El mecanismo manual sigue por si acaso.
- **Solo se promete lo que se sabe:** «hablada en español» solo si TMDB dice que
  se rodó así; para el resto, subtítulos.

---

## Diario

Lo más reciente arriba. Una entrada por PR, y solo lo que le sirva a quien venga
después: qué cambió, por qué, y qué me sorprendió.

### 2026-08-21 — Equipo creado

Nazco con la app ya funcionando. El estado de partida está en `PLAN-ARVIO.md`
(fases 0 a 6.5) y en `SALUD-CODIGO.md`.

---

## Lo siguiente

**Mi encargo abierto: una API de películas con audio latino.**

Descartado y por qué — no reproponer sin argumento nuevo:

- *Scraping en caliente* (Cinecalidad): se construyó y se retiró. Los enlaces
  caducan en horas y hace falta un Chromium de verdad, que no cabe en una
  función sin servidor. Frágil por diseño.
- *Magnet / BitTorrent en el navegador*: solo se abre WebRTC, y los clientes
  normales usan TCP y uTP. Lo único que funciona es el web seed (`ws=`), ya
  implementado en `lib/fuente-propia/magnet.ts`.

De cada candidata hay que responder: ¿clave?, ¿límite de peticiones?, ¿caduca el
enlace?, ¿el audio latino se pide o se supone?, ¿qué pasa el día que se caiga?
