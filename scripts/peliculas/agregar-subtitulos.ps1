# ── Añadir subtítulos a una película ya subida ──────────────────────────────
#
#   Doble clic en «Agregar subtitulos.cmd» (Descargas\Peliculas), o arrastra
#   el .srt encima. Pregunta a qué película, y en segundos queda en la app:
#   sin volver a convertir ni a subir el vídeo.
#
#   powershell -ExecutionPolicy Bypass -File agregar-subtitulos.ps1 "C:\…\catching.es.srt"
#
# Qué hace:
#   1. Busca el .srt (el que arrastres, o los que haya en Descargas\Peliculas y
#      en subidas\) y te pregunta a qué película va.
#   2. Si el .srt viene en codificación de Windows, arregla los acentos.
#   3. Si tienes alass instalado y está el vídeo en subidas\, lo alinea solo al
#      audio de la película. Si no, puedes moverlo a mano con -Desfase.
#   4. Lo sube como .vtt junto a la película y lo apunta en el catálogo.
#
# Opciones:
#   -Idioma eng       si el nombre del archivo no lo dice (por defecto: español)
#   -Desfase 1.5      mueve todos los subtítulos, en segundos: + los retrasa
#                     (si salen antes que la voz), − los adelanta (si salen después)
#   -SinAlinear       no usar alass aunque esté instalado

param(
    [Parameter(Position = 0)]
    [string]$Archivo,
    [string]$Pelicula,
    [string]$Idioma,
    [double]$Desfase = 0,
    [switch]$SinAlinear
)

$ErrorActionPreference = "Continue"   # Ver el porqué en subir-pelicula.ps1.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Paso($t) { Write-Host "`n── $t" -ForegroundColor Cyan }
function Aviso($t) { Write-Host "   ⚠ $t" -ForegroundColor Yellow }
function Fallo($t) { Write-Host "`n✖ $t" -ForegroundColor Red; Read-Host "`nPulsa Enter para cerrar"; exit 1 }
function EscribirSinBom($ruta, $texto) { [System.IO.File]::WriteAllText($ruta, $texto, (New-Object System.Text.UTF8Encoding($false))) }

foreach ($h in @("ffmpeg", "rclone")) {
    if (-not (Get-Command $h -ErrorAction SilentlyContinue)) { Fallo "No encuentro '$h'. Ejecuta preparar-pc.ps1." }
}
$rutaConfig = Join-Path $env:APPDATA "CanalCasa\peliculas.json"
if (-not (Test-Path $rutaConfig)) { Fallo "Sube primero una película con subir-pelicula: ahí se configura R2." }
$config = Get-Content $rutaConfig -Raw -Encoding UTF8 | ConvertFrom-Json
$bandeja = Join-Path $env:USERPROFILE "Downloads\Peliculas"
$subidas = Join-Path $bandeja "subidas"

# ── A qué película ──────────────────────────────────────────────────────────
Paso "Películas subidas"
$rutaCatalogo = "$($config.Remoto):$($config.Cubo)/peliculas/catalogo.json"
$crudo = & rclone cat $rutaCatalogo --s3-no-check-bucket 2>$null | Out-String
if ($LASTEXITCODE -ne 0 -or -not $crudo.Trim()) { Fallo "No pude leer el catálogo de R2. ¿Hay alguna película subida?" }
$catalogo = ConvertFrom-Json $crudo
$lista = @($catalogo.peliculas)
if ($lista.Count -eq 0) { Fallo "No hay películas subidas todavía." }

$elegida = $null
if ($Pelicula) { $elegida = @($lista | Where-Object { $_.id -eq $Pelicula })[0] }
if (-not $elegida) {
    for ($i = 0; $i -lt $lista.Count; $i++) {
        $subs = @($lista[$i].subtitulos | Where-Object { $_ -and $_.url -match "\.vtt$" }).Count
        Write-Host ("   {0}. {1}   ({2} subtítulos)" -f ($i + 1), $lista[$i].titulo, $subs)
    }
    if ($lista.Count -eq 1) {
        $elegida = $lista[0]
        Write-Host "   → $($elegida.titulo)"
    } else {
        $n = Read-Host "`n   ¿A cuál? (número)"
        $indice = 0
        if (-not [int]::TryParse($n, [ref]$indice) -or $indice -lt 1 -or $indice -gt $lista.Count) { Fallo "Número no válido." }
        $elegida = $lista[$indice - 1]
    }
}
$id = $elegida.id

# ── Qué subtítulo ───────────────────────────────────────────────────────────
Paso "Subtítulo"
$EXT = @(".srt", ".vtt", ".ass", ".ssa")
if (-not $Archivo) {
    $candidatos = @()
    foreach ($carpeta in @($bandeja, $subidas)) {
        if (Test-Path $carpeta) {
            $candidatos += @(Get-ChildItem -LiteralPath $carpeta -File | Where-Object { $EXT -contains $_.Extension.ToLower() })
        }
    }
    # El más reciente primero. Los ya usados (que este script guarda como
    # «<id>.es.srt») siguen en la lista a propósito: es lo que se elige para
    # volver a lanzarlo con -Desfase.
    $candidatos = @($candidatos | Sort-Object LastWriteTime -Descending)
    if ($candidatos.Count -eq 0) { Fallo "No encuentro ningún .srt en $bandeja ni en $subidas. Déjalo ahí, o arrástralo sobre «Agregar subtitulos.cmd»." }
    if ($candidatos.Count -eq 1) {
        $Archivo = $candidatos[0].FullName
    } else {
        for ($i = 0; $i -lt $candidatos.Count; $i++) { Write-Host ("   {0}. {1}" -f ($i + 1), $candidatos[$i].Name) }
        $n = Read-Host "`n   ¿Cuál? (número; el 1 es el más reciente)"
        $indice = 0
        if (-not [int]::TryParse($n, [ref]$indice) -or $indice -lt 1 -or $indice -gt $candidatos.Count) { Fallo "Número no válido." }
        $Archivo = $candidatos[$indice - 1].FullName
    }
}
if (-not (Test-Path -LiteralPath $Archivo)) { Fallo "No existe: $Archivo" }
$archivoSub = Get-Item -LiteralPath $Archivo
Write-Host "   $($archivoSub.Name)"

# Idioma: el que se diga, o el que lleve el nombre (…es.srt, …eng.srt), o español.
$IDIOMAS = @{ spa = "Español"; eng = "Inglés"; por = "Portugués"; fra = "Francés"; ita = "Italiano"; deu = "Alemán"; jpn = "Japonés"; kor = "Coreano" }
$EQUIV = @{ es = "spa"; esp = "spa"; spanish = "spa"; espanol = "spa"; latino = "spa"; lat = "spa"; en = "eng"; english = "eng"; ingles = "eng"; pt = "por"; fr = "fra"; fre = "fra"; it = "ita"; de = "deu"; ger = "deu"; ja = "jpn"; ko = "kor" }
function Codigo($texto) {
    $t = ($texto -split "[-_]")[0].ToLower()
    if ($EQUIV.ContainsKey($t)) { return $EQUIV[$t] }
    if ($IDIOMAS.ContainsKey($t)) { return $t }
    return ""
}
$marcas = @(([System.IO.Path]::GetFileNameWithoutExtension($archivoSub.Name)).ToLower().Split(".", [StringSplitOptions]::RemoveEmptyEntries))
$codigo = ""
if ($Idioma) { $codigo = Codigo $Idioma }
if (-not $codigo) { foreach ($m in $marcas) { $c = Codigo $m; if ($c) { $codigo = $c } } }
if (-not $codigo) { $codigo = "spa" }
$forzados = @($marcas | Where-Object { $_ -match "^(forced|forzados?)$" }).Count -gt 0
$etiqueta = $IDIOMAS[$codigo]; if ($forzados) { $etiqueta = "$etiqueta (forzados)" }
$corto = @{ spa = "es"; eng = "en"; por = "pt"; fra = "fr"; ita = "it"; deu = "de"; jpn = "ja"; kor = "ko" }[$codigo]
Write-Host "   Idioma: $etiqueta"

# ── Preparar: acentos, alinear, desfase ─────────────────────────────────────
$trabajo = Join-Path $env:TEMP "canalcasa-subs"
if (Test-Path $trabajo) { Remove-Item -Recurse -Force $trabajo }
New-Item -ItemType Directory -Force -Path $trabajo | Out-Null

# 1. A SRT en UTF-8. Un .srt descargado suele venir en Windows-1252 y ffmpeg
#    lo leería como UTF-8: sin decírselo, ni siquiera lo convierte.
$estricto = New-Object System.Text.UTF8Encoding($false, $true)
$codificacion = @()
try { [void]$estricto.GetString([System.IO.File]::ReadAllBytes($archivoSub.FullName)) } catch { $codificacion = @("-sub_charenc", "CP1252"); Write-Host "   Codificación de Windows: se arreglan los acentos." }
$base = Join-Path $trabajo "base.srt"
& ffmpeg -hide_banner -loglevel error -y @codificacion -i $archivoSub.FullName -c:s srt $base
if ($LASTEXITCODE -ne 0) { Fallo "ffmpeg no pudo leer el subtítulo. ¿Es un .srt de verdad?" }

# 2. Alinear al audio con alass, si está y hay vídeo con el que comparar.
$alass = Get-Command alass-cli, alass -ErrorAction SilentlyContinue | Select-Object -First 1
$video = @(Get-ChildItem -LiteralPath $subidas -File -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -eq $id -and @(".mkv", ".mp4", ".avi", ".mov", ".m4v") -contains $_.Extension.ToLower() })[0]
$aUsar = $base
if ($SinAlinear) {
    Write-Host "   Sin alinear (-SinAlinear)."
} elseif (-not $alass) {
    Write-Host "   alass no está instalado: se sube tal cual. Si va desfasado, vuelve a lanzarlo con -Desfase (ver docs\PELICULAS-JUNTOS.md)."
} elseif (-not $video) {
    Aviso "No encuentro el vídeo de '$id' en $subidas para alinear contra él: se sube tal cual."
} else {
    Paso "Alineando con el audio de la película (alass; puede tardar un par de minutos)"
    $alineado = Join-Path $trabajo "alineado.srt"
    & $alass.Source $video.FullName $base $alineado
    if ($LASTEXITCODE -eq 0 -and (Test-Path $alineado)) { $aUsar = $alineado; Write-Host "   ✔ Alineado." }
    else { Aviso "alass no pudo alinearlo; se sube tal cual." }
}

# 3. A WebVTT, con el desfase manual si se pidió.
$existentes = @($elegida.subtitulos | Where-Object { $_ -and $_.url -match "\.vtt$" })
$n = $existentes.Count
$nombreVtt = "extra$n-$codigo.vtt"
while (@($existentes | Where-Object { $_.url -like "*/$nombreVtt" }).Count -gt 0) { $n++; $nombreVtt = "extra$n-$codigo.vtt" }
$vtt = Join-Path $trabajo $nombreVtt
$desplazar = @()
if ($Desfase -ne 0) {
    $desplazar = @("-itsoffset", $Desfase.ToString([Globalization.CultureInfo]::InvariantCulture))
    Write-Host ("   Desfase: {0:+0.0;-0.0} s" -f $Desfase)
}
& ffmpeg -hide_banner -loglevel error -y @desplazar -i $aUsar -c:s webvtt $vtt
if ($LASTEXITCODE -ne 0) { Fallo "No se pudo pasar a WebVTT." }

# ── Subir y apuntar ─────────────────────────────────────────────────────────
Paso "Subiendo"
$carpetaR2 = "$($config.Remoto):$($config.Cubo)/peliculas/$id"
& rclone copyto $vtt "$carpetaR2/$nombreVtt" --s3-no-check-bucket --header-upload "Content-Type: text/vtt; charset=utf-8" --header-upload "Cache-Control: public, max-age=300"
if ($LASTEXITCODE -ne 0) { Fallo "Falló la subida del subtítulo." }

$publica = "$($config.UrlPublica)/peliculas/$id"
# Si ya hay uno con ese nombre (lo normal al repetir con -Desfase), por
# defecto se reemplaza: dos «Español» en el selector, uno desfasado, confunden.
$nombre = $etiqueta
$igual = @($existentes | Where-Object { $_.label -eq $etiqueta })
if ($igual.Count -gt 0) {
    $r = Read-Host "   Ya tiene «$etiqueta». [R] reemplazarlo (por defecto) · [A] añadir otro"
    if ($r -match "^[aA]") {
        $k = 2
        while (@($existentes | Where-Object { $_.label -eq $nombre }).Count -gt 0) { $nombre = "$etiqueta $k"; $k++ }
    } else {
        foreach ($viejo in $igual) {
            $archivoViejo = ($viejo.url -split "/")[-1]
            & rclone deletefile "$carpetaR2/$archivoViejo" --s3-no-check-bucket 2>$null | Out-Null
        }
        $existentes = @($existentes | Where-Object { $_.label -ne $etiqueta })
    }
}
$nueva = [pscustomobject]@{ label = $nombre; srclang = $corto; url = "$publica/$nombreVtt" }
# De paso se limpian las pistas que no son .vtt (la fantasma de la primera subida).
$elegida.subtitulos = @($existentes) + @($nueva)

$temporal = Join-Path $trabajo "catalogo.json"
EscribirSinBom $temporal (ConvertTo-Json -Depth 6 -InputObject ([pscustomobject]@{ version = 1; peliculas = $lista }))
& rclone copyto $temporal $rutaCatalogo --s3-no-check-bucket --header-upload "Content-Type: application/json; charset=utf-8" --header-upload "Cache-Control: no-cache"
if ($LASTEXITCODE -ne 0) { Fallo "Se subió el subtítulo pero no se pudo actualizar el catálogo. Vuelve a lanzarlo." }

# El .srt se guarda junto a la película, con su nombre, para no ofrecerlo otra vez.
New-Item -ItemType Directory -Force -Path $subidas | Out-Null
$sufijo = ".$corto"; if ($forzados) { $sufijo = "$sufijo.forced" }
$destino = Join-Path $subidas "$id$sufijo$($archivoSub.Extension)"
if ($archivoSub.FullName -ne $destino) {
    if (Test-Path -LiteralPath $destino) { $destino = Join-Path $subidas "$id$sufijo-$(Get-Date -Format yyyyMMddHHmmss)$($archivoSub.Extension)" }
    Move-Item -LiteralPath $archivoSub.FullName -Destination $destino -ErrorAction SilentlyContinue
}
Remove-Item -Recurse -Force $trabajo -ErrorAction SilentlyContinue

Write-Host "`n✔ «$nombre» añadido a «$($elegida.titulo)»." -ForegroundColor Green
Write-Host "   En la app: abre la película y elige el subtítulo en el botón de subtítulos."
Write-Host "   ¿Desfasado? Vuelve a lanzarlo con -Desfase (ej. -Desfase 1.5 o -Desfase -2) y elige el nuevo."
Read-Host "`nPulsa Enter para cerrar"
