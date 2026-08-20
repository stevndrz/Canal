"""
Extractor de enlaces directos, en caliente.

Por qué existe como servicio aparte y no como una ruta de Next
──────────────────────────────────────────────────────────────
Necesita un navegador de verdad —Chromium— para recorrer una cadena de
redirecciones que solo existe si se ejecuta JavaScript. Eso son ~400 MB de
binario y entre 10 y 30 segundos por petición, así que no cabe en una función
sin servidor: Vercel corta a los 10 s en el plan gratuito y no trae navegador.

Va en una máquina propia (un VPS pequeño, un Raspberry Pi, o el mismo
ordenador de casa) y la aplicación le pregunta cuando alguien pulsa el botón.

Por qué en caliente y no cacheado en una base de datos
──────────────────────────────────────────────────────
Los enlaces vienen firmados con caducidad de unas horas. Guardarlos de
antemano produciría un catálogo que funciona el día que se rellena y está roto
al siguiente, y encima sin decir por qué. Se pide en el momento del clic o no
se pide.

Lo que sí se guarda es un caché **en memoria y corto** (`CACHE_SEGUNDOS`): si
tres personas de la casa abren la misma película en la misma tarde, se recorre
el sitio una vez y no tres.

Arranque
────────
    pip install -r requirements.txt
    playwright install chromium
    uvicorn main:app --host 0.0.0.0 --port 8000

Y en la aplicación, `EXTRACTOR_URL=http://<esta-maquina>:8000`.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
import unicodedata
from dataclasses import dataclass
from typing import Final
from urllib.parse import quote_plus, urlparse

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import Browser, async_playwright

log = logging.getLogger("extractor")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ── Ajustes ──────────────────────────────────────────────────────────────────

#: De dónde se acepta que llame el navegador. En producción hay que ponerlo:
#: `*` deja que cualquier página abierta en el navegador use este servicio.
ORIGENES: Final[list[str]] = [
    o.strip() for o in os.getenv("ORIGENES_PERMITIDOS", "http://localhost:3000").split(",") if o.strip()
]

#: Solo se navega a estos dominios. Sin esta lista, el parámetro `url` haría de
#: este servicio un proxy abierto: cualquiera podría pedirle que visitase una
#: dirección interna de la red donde corre y devolviera lo que encontrara.
DOMINIOS_PERMITIDOS: Final[set[str]] = {
    d.strip().lower()
    for d in os.getenv("DOMINIOS_PERMITIDOS", "cinecalidad.am,www.cinecalidad.am").split(",")
    if d.strip()
}

#: Cuánto se reutiliza un enlace ya extraído. Muy por debajo de su caducidad
#: real (~12 h) para no servir nunca uno a punto de morir.
CACHE_SEGUNDOS: Final[int] = int(os.getenv("CACHE_SEGUNDOS", "1800"))

#: Tope por petición. Sin él, un sitio que no responde deja la pestaña colgada
#: y acaba agotando la memoria del servicio.
TIMEOUT_MS: Final[int] = int(os.getenv("TIMEOUT_MS", "45000"))

#: Cuántos navegados a la vez. Cada pestaña son ~150 MB: con más de dos en un
#: equipo pequeño, el sistema empieza a matar procesos.
MAX_SIMULTANEOS: Final[int] = int(os.getenv("MAX_SIMULTANEOS", "2"))

#: Chromium a usar, si no vale el que instala Playwright.
#: Playwright exige la compilación exacta que espera su versión, y en una
#: máquina que ya tiene Chromium por otro motivo eso significa descargar 400 MB
#: repetidos —o fallar al arrancar si las versiones no coinciden. Con esto se
#: le señala el que ya hay.
CHROMIUM_PATH: Final[str] = os.getenv("CHROMIUM_PATH", "").strip()


@dataclass
class Entrada:
    url: str
    expira_en: float


_cache: dict[str, Entrada] = {}
_navegador: Browser | None = None
_playwright = None
_semaforo = asyncio.Semaphore(MAX_SIMULTANEOS)

app = FastAPI(title="Extractor CanalCasa", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def arrancar() -> None:
    """
    El navegador se abre **una vez** y se reutiliza.

    Lanzar Chromium por petición añade 2-4 segundos a cada clic y multiplica la
    memoria. Se abre uno y cada petición usa una pestaña suya, que es barata.
    """
    global _navegador, _playwright
    _playwright = await async_playwright().start()
    _navegador = await _playwright.chromium.launch(
        headless=True,
        # `--no-sandbox` porque dentro de un contenedor no hay espacios de
        # nombres de usuario y Chromium no arranca sin ello; `--disable-dev-shm-usage`
        # porque /dev/shm suele ser de 64 MB y una pestaña lo llena.
        args=["--no-sandbox", "--disable-dev-shm-usage"],
        **({"executable_path": CHROMIUM_PATH} if CHROMIUM_PATH else {}),
    )
    log.info("navegador listo · dominios permitidos: %s", ", ".join(sorted(DOMINIOS_PERMITIDOS)))


@app.on_event("shutdown")
async def apagar() -> None:
    if _navegador:
        await _navegador.close()
    if _playwright:
        await _playwright.stop()


@app.get("/salud")
async def salud() -> dict[str, object]:
    """Para saber si el servicio está vivo sin gastar un navegado."""
    return {"estado": "ok", "navegador": _navegador is not None, "en_cache": len(_cache)}


@app.get("/extraer")
async def extraer(
    url: str | None = Query(None, description="Ficha de la película en el sitio de origen"),
    titulo: str | None = Query(None, description="Título, cuando no se sabe la ficha"),
    anio: str | None = Query(None, description="Año, para desempatar títulos repetidos"),
):
    """
    Devuelve el `.mp4` directo de una película, o dice por qué no pudo.

    Dos formas de pedirla:

      - `?url=` — la ficha exacta. Es lo que se usa si algún día se guardan las
        direcciones en `catalog.json`.
      - `?titulo=&anio=` — se busca primero en el sitio. Es lo que usa la
        aplicación, porque de TMDB solo salen título y año: la ficha del sitio
        de origen no la conoce nadie hasta que se busca.

    La respuesta lleva siempre `estado`, y el frontend decide con eso. Nunca
    lanza un 500 con una traza: que un sitio ajeno falle es lo normal aquí, no
    una excepción del programa.
    """
    if not url and not titulo:
        return {"estado": "rechazado", "motivo": "Hace falta `url` o `titulo`."}

    if url and not dominio_permitido(url):
        return {
            "estado": "rechazado",
            "motivo": "Ese dominio no está en la lista permitida del extractor.",
        }

    clave = url or f"buscar::{(titulo or '').lower()}::{anio or ''}"

    if (entrada := _cache.get(clave)) and entrada.expira_en > time.time():
        return {"estado": "ok", "url": entrada.url, "desde_cache": True}

    async with _semaforo:
        # Se vuelve a mirar el caché: mientras se esperaba el turno, otra
        # petición de la misma película puede haberlo dejado resuelto.
        if (entrada := _cache.get(clave)) and entrada.expira_en > time.time():
            return {"estado": "ok", "url": entrada.url, "desde_cache": True}

        try:
            enlace = await asyncio.wait_for(
                _resolver(url, titulo, anio), timeout=(TIMEOUT_MS / 1000) + 15
            )
        except asyncio.TimeoutError:
            log.warning("tiempo agotado: %s", clave)
            return {"estado": "timeout", "motivo": "El sitio tardó demasiado en responder."}
        except _SinFicha:
            return {
                "estado": "no_encontrado",
                "motivo": "Esa película no está en el sitio de origen.",
            }
        except Exception as error:  # noqa: BLE001 — cualquier fallo del sitio ajeno
            log.warning("fallo extrayendo %s: %s", clave, error)
            return {"estado": "error", "motivo": "No se pudo leer el enlace en el sitio de origen."}

    if not enlace:
        return {
            "estado": "no_encontrado",
            "motivo": "La película está, pero ahora mismo no ofrece descarga directa.",
        }

    _cache[clave] = Entrada(url=enlace, expira_en=time.time() + CACHE_SEGUNDOS)
    return {"estado": "ok", "url": enlace, "desde_cache": False}


class _SinFicha(Exception):
    """La búsqueda no encontró ninguna ficha que se parezca lo bastante."""


async def _resolver(url: str | None, titulo: str | None, anio: str | None) -> str | None:
    """Encuentra la ficha si hace falta, y extrae de ella."""
    ficha = url or await _buscar_ficha(titulo or "", anio)
    if not ficha:
        raise _SinFicha
    return await _extraer(ficha)


def dominio_permitido(url: str) -> bool:
    try:
        anfitrion = (urlparse(url).hostname or "").lower()
    except ValueError:
        return False
    return anfitrion in DOMINIOS_PERMITIDOS


async def _buscar_ficha(titulo: str, anio: str | None) -> str | None:
    """
    Busca la película en el sitio y devuelve la dirección de su ficha.

    Existe porque de TMDB solo salen el título y el año: la dirección que usa
    el sitio de origen no la conoce nadie hasta que se busca.

    El resultado se elige comparando títulos normalizados, no cogiendo el
    primero. Buscar «It» devuelve una docena de cosas, y el primero rara vez es
    el que se quiere; con el año delante el acierto es casi seguro.
    """
    assert _navegador is not None, "el navegador no está listo"

    dominio = next(iter(sorted(DOMINIOS_PERMITIDOS)))
    contexto = await _navegador.new_context(user_agent=_AGENTE, viewport={"width": 1280, "height": 800})
    await _aligerar(contexto)
    pagina = await contexto.new_page()
    pagina.set_default_timeout(TIMEOUT_MS)

    try:
        consulta = f"{titulo} {anio}".strip() if anio else titulo
        await pagina.goto(
            f"https://{dominio}/?s={quote_plus(consulta)}", wait_until="domcontentloaded"
        )

        candidatos = await pagina.evaluate(
            """() => [...document.querySelectorAll('a')]
                 .map(a => ({ href: a.href, texto: (a.textContent || '').trim() }))
                 .filter(x => x.href && x.texto)"""
        )

        buscado = _normalizar(titulo)
        # Primero una coincidencia exacta del título normalizado; si no, que el
        # título buscado esté contenido en el del enlace. Nunca «el primero que
        # salga», que es como acaban colándose tráileres y páginas de género.
        for exacto in (True, False):
            for candidato in candidatos:
                texto = _normalizar(candidato["texto"])
                if not texto:
                    continue
                if (texto == buscado) if exacto else (buscado in texto and len(buscado) > 3):
                    if dominio_permitido(candidato["href"]):
                        return candidato["href"]
        return None
    finally:
        await contexto.close()


def _normalizar(texto: str) -> str:
    """Sin acentos, sin puntuación y en minúsculas, para poder comparar."""
    sin_tildes = unicodedata.normalize("NFD", texto)
    solo_letras = "".join(c for c in sin_tildes if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", solo_letras.lower()).strip()


_AGENTE: Final[str] = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)


async def _aligerar(contexto) -> None:
    """
    No descarga lo que no se va a mirar.

    Aquí no se renderiza nada: solo se siguen enlaces. Bloquear imágenes,
    vídeo, tipografías y hojas de estilo deja cada paso en la mitad de tiempo,
    y son cuatro pasos por película.
    """
    await contexto.route(
        "**/*",
        lambda ruta: asyncio.ensure_future(
            ruta.abort()
            if ruta.request.resource_type in {"image", "media", "font", "stylesheet"}
            else ruta.continue_()
        ),
    )


async def _extraer(url_pelicula: str) -> str | None:
    """
    Recorre la cadena hasta el enlace final.

    El camino es: ficha → aviso intermedio → «HD quality» → «Descargar
    archivo» → «Enlace de descarga directa». Cada paso es una página distinta
    y ninguno se puede saltar.

    Diferencias con el script de escritorio del que sale esto:
      - Sin cabeza y con una pestaña por petición, no un navegador entero.
      - Se bloquean imágenes, tipografías y hojas de estilo: no se va a mirar
        la página, solo a seguir enlaces, y sin ellas cada paso tarda la mitad.
      - Cada paso comprueba que encontró lo que buscaba y devuelve `None` en
        vez de reventar, porque un sitio ajeno cambia su HTML cuando quiere.
    """
    assert _navegador is not None, "el navegador no está listo"

    contexto = await _navegador.new_context(user_agent=_AGENTE, viewport={"width": 1280, "height": 800})
    await _aligerar(contexto)

    pagina = await contexto.new_page()
    pagina.set_default_timeout(TIMEOUT_MS)

    try:
        await pagina.goto(url_pelicula, wait_until="domcontentloaded")

        # 1. El enlace del proveedor dentro de la ficha.
        boton = pagina.locator("a:has-text('Vimeos')").first
        if await boton.count() == 0:
            return None
        destino = await boton.get_attribute("href")
        if not destino:
            return None
        if not destino.startswith("http"):
            base = f"{urlparse(url_pelicula).scheme}://{urlparse(url_pelicula).hostname}"
            destino = f"{base}{destino}"

        # 2. La página de aviso, que a veces aparece y a veces no.
        await pagina.goto(destino, wait_until="domcontentloaded")
        continuar = pagina.locator("a:has-text('Vimeos.net'), a:has-text('Continuar')").first
        if await continuar.count() > 0:
            await continuar.click()
            await pagina.wait_for_load_state("domcontentloaded")

        # 3. Calidad, descarga y enlace final.
        for selector in (
            "a:has-text('HD quality')",
            "a:has-text('Descargar archivo'), button:has-text('Descargar archivo')",
        ):
            paso = pagina.locator(selector).first
            if await paso.count() == 0:
                return None
            await paso.click()
            await pagina.wait_for_load_state("domcontentloaded")

        final = pagina.locator("a:has-text('Enlace de descarga directa')").first
        if await final.count() == 0:
            return None
        return await final.get_attribute("href")
    finally:
        await contexto.close()
