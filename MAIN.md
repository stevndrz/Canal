# Orquestación ORCA - MAIN.md

## Agentes y Territorios
- **canales**: `livetv/`, `live-card.tsx`, `channels.ts`
- **reproduccion**: `stream-player.tsx`, `fullscreen-player.tsx`, `native-player.tsx`
- **datos-m3u**: `m3u.ts`, `categories.ts`, `logos.ts`
- **epg-guia**: `epg.ts`, `parrilla.ts`, `/api/guia`
- **catalogo**: `peliculas/`, `catalog/`, `tmdb.ts`
- **fuente-propia**: `fuente-propia/`, `stremio.ts`
- **config-seguridad**: `config*.ts`, `url-segura.ts`, `next.config.ts`, CSP
- **diseno**: `shell.css`, `globals.css` (ÚNICO que edita CSS)
- **calidad**: Refactors seguros no-comportamentales, tests, CI
- **dispositivos**: QA en iPhone/PC/TV (solo auditoría)

## Reglas Inquebrantables
1. Un agente = Un PR (NUNCA los agentes fusionan a main).
2. Memoria obligatoria (`docs/equipo/<agente>.md`).
3. `npm run verify` POR COMMIT.
