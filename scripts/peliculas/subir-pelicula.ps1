# ── Subir una película para «Ver juntos» ────────────────────────────────────
#
#   Arrastra el archivo sobre subir-pelicula.cmd, o:
#   powershell -ExecutionPolicy Bypass -File subir-pelicula.ps1 "C:\Pelis\Mi peli.mkv"
#
# Qué hace, en orden:
#   1. Mira qué trae el archivo (ffprobe): vídeo, audios, subtítulos.
#   2. Lo pasa a HLS, que es lo que reproduce la app en cualquier aparato —
#      teles viejas incluidas—, con TODOS los audios elegibles desde el
#      reproductor y los subtítulos de texto como .vtt aparte.
#      - Vídeo H.264 de 8 bits hasta 1080p: se COPIA tal cual (minutos).
#      - H.265, 10 bits, 4K o HDR: se recodifica a H.264 High 4.1, lo que
#        decodifica cualquier tele (más lento; con tarjeta gráfica, mucho menos).
#      - Audio: AAC estéreo. Un 5.1 en AC3/DTS no suena en muchas teles.
#   3. Lo sube a Cloudflare R2 con rclone.
#   4. Lo apunta en peliculas/catalogo.json, que es de donde la app saca la
#      lista de «Nuestras películas».
#
# Probado por partes (los mismos argumentos de ffmpeg sobre un MKV con dos
# audios AC3 y subtítulos SRT, y uno H.265 de 10 bits con HDR). Ver
# docs/PELICULAS-JUNTOS.md para preparar R2 y rclone la primera vez.
#
# Compatible con el PowerShell 5.1 que trae Windows: nada de `??`, ternarios
# ni `-AsHashtable`.

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Archivo,

    # Lo que se ve en la app. Por defecto, el nombre del archivo.
    [string]$Titulo,

    # El audio que suena al empezar (código ISO de 3 letras: spa, eng, jpn…).
    [string]$AudioPrincipal = "spa",

    # Recodifica el vídeo aunque se pudiera copiar.
    [switch]$Recodificar,

    # Con qué se recodifica. «auto» prueba la tarjeta gráfica y, si no hay, la CPU.
    [ValidateSet("auto", "cpu", "nvidia", "intel", "amd")]
    [string]$Aceleracion = "auto",

    # Convierte y deja la carpeta en disco, sin subir nada.
    [switch]$SoloConvertir
)

# «Continue» y no «Stop»: en PowerShell 5.1, con «Stop», cualquier línea que
# ffmpeg o rclone escriban por stderr al redirigirla se vuelve un error fatal —y
# ffmpeg escribe ahí todo su progreso—. Cada programa se comprueba por su
# código de salida.
$ErrorActionPreference = "Continue"
# Para que los acentos salgan bien en la consola y al leer ffprobe.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Paso($texto) { Write-Host "`n── $texto" -ForegroundColor Cyan }
function Aviso($texto) { Write-Host "   ⚠ $texto" -ForegroundColor Yellow }
function Fallo($texto) { Write-Host "`n✖ $texto" -ForegroundColor Red; Read-Host "`nPulsa Enter para cerrar"; exit 1 }
function EscribirSinBom($ruta, $texto) {
    # PowerShell 5.1 escribe UTF-8 CON marca BOM, y un JSON con BOM rompe el
    # `JSON.parse` del navegador. Se escribe a mano.
    [System.IO.File]::WriteAllText($ruta, $texto, (New-Object System.Text.UTF8Encoding($false)))
}

# ── Herramientas ────────────────────────────────────────────────────────────
foreach ($herramienta in @("ffmpeg", "ffprobe", "rclone")) {
    if (-not (Get-Command $herramienta -ErrorAction SilentlyContinue)) {
        if ($herramienta -eq "rclone" -and $SoloConvertir) { continue }
        Fallo "No encuentro '$herramienta'. Instálalo con:  winget install $(if ($herramienta -eq 'rclone') { 'Rclone.Rclone' } else { 'Gyan.FFmpeg' })  y abre una terminal nueva."
    }
}
if (-not (Test-Path -LiteralPath $Archivo)) { Fallo "No existe el archivo: $Archivo" }
$Archivo = (Resolve-Path -LiteralPath $Archivo).Path

# ── Configuración (se pregunta una vez y se guarda) ─────────────────────────
$carpetaConfig = Join-Path $env:APPDATA "CanalCasa"
$rutaConfig = Join-Path $carpetaConfig "peliculas.json"
if (Test-Path $rutaConfig) {
    $config = Get-Content $rutaConfig -Raw -Encoding UTF8 | ConvertFrom-Json
} elseif (-not $SoloConvertir) {
    Paso "Primera vez: dónde se suben las películas"
    Write-Host "   (Lo de docs/PELICULAS-JUNTOS.md. Se guarda en $rutaConfig)"
    $remoto = Read-Host "   Nombre del remoto de rclone [r2]"
    if (-not $remoto) { $remoto = "r2" }
    $cubo = Read-Host "   Nombre del bucket de R2"
    $publica = Read-Host "   URL pública del bucket (https://pub-….r2.dev)"
    $config = [pscustomobject]@{ Remoto = $remoto; Cubo = $cubo; UrlPublica = $publica.TrimEnd("/") }
    New-Item -ItemType Directory -Force -Path $carpetaConfig | Out-Null
    EscribirSinBom $rutaConfig ($config | ConvertTo-Json)
}

# ── Qué trae el archivo ─────────────────────────────────────────────────────
Paso "Leyendo el archivo"
$sonda = & ffprobe -v error -print_format json -show_streams -show_format -- $Archivo | Out-String | ConvertFrom-Json
$video = @($sonda.streams | Where-Object { $_.codec_type -eq "video" -and -not ($_.disposition.attached_pic -eq 1) })[0]
$audios = @($sonda.streams | Where-Object { $_.codec_type -eq "audio" })
$subs = @($sonda.streams | Where-Object { $_.codec_type -eq "subtitle" })
if (-not $video) { Fallo "El archivo no tiene vídeo." }
if ($audios.Count -eq 0) { Fallo "El archivo no tiene audio." }

$IDIOMAS = @{
    spa = "Español"; es = "Español"; eng = "Inglés"; en = "Inglés"; jpn = "Japonés"; ja = "Japonés"
    por = "Portugués"; fra = "Francés"; fre = "Francés"; ita = "Italiano"; deu = "Alemán"; ger = "Alemán"
    kor = "Coreano"; zho = "Chino"; chi = "Chino"
}
function Idioma($pista) {
    $codigo = ""
    if ($pista.tags -and $pista.tags.language) { $codigo = $pista.tags.language.ToLower() }
    if ($codigo -eq "und") { $codigo = "" }
    return $codigo
}
function Nombre($pista, $porDefecto) {
    if ($pista.tags -and $pista.tags.title) { return $pista.tags.title.Trim() }
    $codigo = Idioma $pista
    if ($codigo -and $IDIOMAS.ContainsKey($codigo)) { return $IDIOMAS[$codigo] }
    if ($codigo) { return $codigo }
    return $porDefecto
}

# El principal primero: el reproductor arranca con el primero marcado DEFAULT.
$audios = @($audios | Sort-Object { if ((Idioma $_) -eq $AudioPrincipal) { 0 } else { 1 } }, index)

Write-Host ("   Vídeo: {0} {1}x{2} {3}" -f $video.codec_name, $video.width, $video.height, $video.pix_fmt)
for ($i = 0; $i -lt $audios.Count; $i++) {
    Write-Host ("   Audio {0}: {1} ({2}, {3} canales){4}" -f ($i + 1), (Nombre $audios[$i] "Audio $($i + 1)"), $audios[$i].codec_name, $audios[$i].channels, $(if ($i -eq 0) { "  ← principal" } else { "" }))
}

if (-not $Titulo) { $Titulo = [System.IO.Path]::GetFileNameWithoutExtension($Archivo) -replace "[._]+", " " }
# Identificador para carpetas y URLs: sin acentos, sin espacios.
$id = $Titulo.Normalize([Text.NormalizationForm]::FormD) -replace "\p{Mn}", ""
$id = ($id.ToLower() -replace "[^a-z0-9]+", "-").Trim("-")
if (-not $id) { $id = "pelicula" }
Write-Host "   Título: $Titulo   (carpeta: $id)"

# ── Vídeo: copiar o recodificar ─────────────────────────────────────────────
$esHdr = @("smpte2084", "arib-std-b67") -contains $video.color_transfer
$nivel = 0; if ($video.level) { $nivel = [int]$video.level }
$copiable = ($video.codec_name -eq "h264") -and ($video.pix_fmt -eq "yuv420p") -and ([int]$video.width -le 1920) -and ($nivel -le 41) -and -not $esHdr
$filtros = @()
if ($esHdr) {
    $hayZscale = (& ffmpeg -hide_banner -filters 2>$null | Out-String) -match "zscale"
    if ($hayZscale) {
        $filtros += "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
    } else {
        Aviso "La película es HDR y este ffmpeg no trae 'zscale': los colores saldrán lavados. Instala la versión completa: winget install Gyan.FFmpeg"
    }
}
if ([int]$video.width -gt 1920) { $filtros += "scale='min(1920,iw)':-2" }

function ArgumentosVideo($modo) {
    $f = @(); if ($filtros.Count -gt 0) { $f = @("-vf", ($filtros -join ",")) }
    # Un fotograma clave cada 6 s: cada segmento HLS empieza limpio y saltar
    # en la película es instantáneo.
    $claves = @("-force_key_frames", "expr:gte(t,n_forced*6)")
    $tope = @("-maxrate", "8M", "-bufsize", "16M")
    switch ($modo) {
        "nvidia" { return $f + @("-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr", "-cq", "21", "-b:v", "0", "-profile:v", "high", "-level:v", "4.1", "-pix_fmt", "yuv420p", "-forced-idr", "1") + $tope + $claves }
        "intel"  { return $f + @("-c:v", "h264_qsv", "-preset", "medium", "-global_quality", "21", "-profile:v", "high", "-level", "41", "-pix_fmt", "nv12") + $tope + $claves }
        "amd"    { return $f + @("-c:v", "h264_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", "20", "-qp_p", "22", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "nv12") + $claves }
        default  { return $f + @("-c:v", "libx264", "-preset", "medium", "-crf", "21", "-profile:v", "high", "-level:v", "4.1", "-pix_fmt", "yuv420p") + $tope + $claves }
    }
}
function FuncionaCodificador($nombre) {
    & ffmpeg -hide_banner -loglevel error -f lavfi -i "color=size=256x256" -frames:v 1 -c:v $nombre -f null - 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

$modos = @()
if ($copiable -and -not $Recodificar) {
    Write-Host "   El vídeo ya es compatible: se copia sin recodificar. Esto va rápido."
} else {
    $motivo = @()
    if ($video.codec_name -ne "h264") { $motivo += $video.codec_name }
    if ($video.pix_fmt -ne "yuv420p") { $motivo += $video.pix_fmt }
    if ([int]$video.width -gt 1920) { $motivo += "más de 1080p" }
    if ($esHdr) { $motivo += "HDR" }
    if ($motivo.Count -gt 0) { Write-Host "   Hay que recodificar ($($motivo -join ', ')) para que lo reproduzca cualquier tele." }
    if ($Aceleracion -eq "auto") {
        if (FuncionaCodificador "h264_nvenc") { $modos += "nvidia" }
        elseif (FuncionaCodificador "h264_qsv") { $modos += "intel" }
        elseif (FuncionaCodificador "h264_amf") { $modos += "amd" }
    } elseif ($Aceleracion -ne "cpu") { $modos += $Aceleracion }
    $modos += "cpu"   # Siempre de respaldo: si la tarjeta falla a mitad, se reintenta.
    Write-Host "   Con: $($modos[0])$(if ($modos[0] -eq 'cpu') { '  (sin tarjeta gráfica: puede tardar casi lo que dura la película)' })"
}

# ── Conversión a HLS ────────────────────────────────────────────────────────
$salida = Join-Path $env:TEMP "canalcasa\$id"
$mapa = @("-map", "0:$($video.index)")
$flujos = @("v:0,agroup:aud,name:video")
for ($i = 0; $i -lt $audios.Count; $i++) {
    $mapa += @("-map", "0:$($audios[$i].index)")
    $idioma = Idioma $audios[$i]; if (-not $idioma) { $idioma = "und" }
    $flujos += "a:$i,agroup:aud,language:$idioma,name:a$i$(if ($i -eq 0) { ',default:yes' })"
}
$comunes = @(
    "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000",
    "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
    "-hls_flags", "independent_segments", "-hls_segment_type", "mpegts",
    "-master_pl_name", "master.m3u8",
    # Rutas relativas con «/», y ffmpeg trabajando DESDE la carpeta de salida:
    # con rutas de Windows, la lista maestra podía acabar apuntando a
    # «a0\index.m3u8», que ningún navegador entiende.
    "-hls_segment_filename", "%v/s%05d.ts",
    "-var_stream_map", ($flujos -join " "),
    "%v/index.m3u8"
)

$hecho = $false
$intentos = $modos; if ($intentos.Count -eq 0) { $intentos = @("copiar") }
foreach ($modo in $intentos) {
    Paso "Convirtiendo ($modo). Verás el avance abajo; no cierres la ventana."
    if (Test-Path $salida) { Remove-Item -Recurse -Force $salida }
    New-Item -ItemType Directory -Force -Path $salida | Out-Null
    if ($modo -eq "copiar") { $argsVideo = @("-c:v", "copy") } else { $argsVideo = ArgumentosVideo $modo }
    Push-Location $salida
    # «-v error -stats»: el avance sí, los avisos inofensivos de ffmpeg
    # («frame size not set» en los audios) no, que solo asustan.
    & ffmpeg -hide_banner -loglevel error -stats -y -i $Archivo @mapa @argsVideo @comunes
    $codigo = $LASTEXITCODE
    Pop-Location
    if ($codigo -eq 0) { $hecho = $true; break }
    Aviso "Falló con '$modo'."
}
if (-not $hecho) { Fallo "No se pudo convertir. Copia lo que salió en rojo arriba y pásamelo." }

# ffmpeg llama a los audios «audio_1», «audio_2»…; el selector del reproductor
# enseña este NAME, así que se pone el de verdad. Se busca por su URI (a0/,
# a1/…), que es lo único estable.
$rutaMaestra = Join-Path $salida "master.m3u8"
$maestra = [System.IO.File]::ReadAllText($rutaMaestra)
for ($i = 0; $i -lt $audios.Count; $i++) {
    $nombre = (Nombre $audios[$i] "Audio $($i + 1)") -replace '"', "'"
    $maestra = [regex]::Replace($maestra, "NAME=""[^""]*""(?=[^\r\n]*URI=""a$i/)", "NAME=""$nombre""")
}
EscribirSinBom $rutaMaestra $maestra

# ── Subtítulos ──────────────────────────────────────────────────────────────
$DE_TEXTO = @("subrip", "ass", "ssa", "webvtt", "mov_text", "text")
$subtitulos = @()
$n = 0
foreach ($s in $subs) {
    if ($DE_TEXTO -notcontains $s.codec_name) {
        Aviso "Subtítulo '$(Nombre $s $s.codec_name)' es una imagen ($($s.codec_name)): no se puede pasar a texto, se omite."
        continue
    }
    $idioma = Idioma $s; if (-not $idioma) { $idioma = "und" }
    $archivoVtt = "sub$n-$idioma.vtt"
    & ffmpeg -hide_banner -loglevel error -y -i $Archivo -map "0:$($s.index)" -c:s webvtt (Join-Path $salida $archivoVtt)
    if ($LASTEXITCODE -ne 0) { Aviso "No se pudo convertir un subtítulo; se omite."; continue }
    $etiqueta = Nombre $s "Subtítulos"
    if ($s.disposition.forced -eq 1) { $etiqueta = "$etiqueta (forzados)" }
    $srclang = $idioma
    if ($srclang.Length -eq 3 -and @("spa", "eng", "por", "fra", "ita", "jpn") -contains $srclang) {
        $srclang = @{ spa = "es"; eng = "en"; por = "pt"; fra = "fr"; ita = "it"; jpn = "ja" }[$srclang]
    }
    $subtitulos += [pscustomobject]@{ label = $etiqueta; srclang = $srclang; archivo = $archivoVtt }
    $n++
}
Write-Host "   Subtítulos: $($subtitulos.Count)"

$tamano = (Get-ChildItem -Recurse $salida | Measure-Object -Property Length -Sum).Sum
Write-Host ("   Listo en disco: {0:N1} GB en {1}" -f ($tamano / 1GB), $salida)
if ($SoloConvertir) { Write-Host "`n✔ Convertida. No se subió nada (-SoloConvertir)." -ForegroundColor Green; exit 0 }

# ── Subida a R2 ─────────────────────────────────────────────────────────────
$destino = "$($config.Remoto):$($config.Cubo)/peliculas/$id"
Paso "Subiendo a R2 ($destino)"
# El tipo de cada archivo se fija a mano: por extensión, Windows dice que un
# .ts es TypeScript, y algunas teles se niegan a reproducir un segmento con
# un tipo que no es de vídeo.
$tipos = @(
    @{ patron = "*.ts"; tipo = "video/mp2t"; cache = "public, max-age=31536000, immutable" },
    @{ patron = "*.m3u8"; tipo = "application/vnd.apple.mpegurl"; cache = "public, max-age=300" },
    @{ patron = "*.vtt"; tipo = "text/vtt; charset=utf-8"; cache = "public, max-age=300" }
)
foreach ($t in $tipos) {
    & rclone copy $salida $destino --include $t.patron --transfers 8 --s3-no-check-bucket `
        --header-upload "Content-Type: $($t.tipo)" --header-upload "Cache-Control: $($t.cache)" --progress
    if ($LASTEXITCODE -ne 0) { Fallo "Falló la subida ($($t.patron)). Revisa la conexión o la configuración de rclone y vuelve a lanzarlo: lo ya subido no se repite." }
}

# ── Catálogo ────────────────────────────────────────────────────────────────
Paso "Apuntándola en «Nuestras películas»"
$rutaCatalogo = "$($config.Remoto):$($config.Cubo)/peliculas/catalogo.json"
$actual = & rclone cat $rutaCatalogo --s3-no-check-bucket 2>$null | Out-String
$lista = @()
if ($LASTEXITCODE -eq 0 -and $actual.Trim()) { $lista = @((ConvertFrom-Json $actual).peliculas) }
$base = "$($config.UrlPublica)/peliculas/$id"
$entrada = [pscustomobject]@{
    id         = $id
    titulo     = $Titulo
    url        = "$base/master.m3u8"
    subtitulos = @($subtitulos | ForEach-Object { [pscustomobject]@{ label = $_.label; srclang = $_.srclang; url = "$base/$($_.archivo)" } })
    duracion   = [math]::Round([double]$sonda.format.duration)
    subida     = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}
$lista = @($entrada) + @($lista | Where-Object { $_ -and $_.id -ne $id })
$temporal = Join-Path $env:TEMP "canalcasa-catalogo.json"
EscribirSinBom $temporal (ConvertTo-Json -Depth 6 -InputObject ([pscustomobject]@{ version = 1; peliculas = $lista }))
& rclone copyto $temporal $rutaCatalogo --s3-no-check-bucket --header-upload "Content-Type: application/json; charset=utf-8" --header-upload "Cache-Control: no-cache"
if ($LASTEXITCODE -ne 0) { Fallo "Se subió la película pero no se pudo actualizar el catálogo. Vuelve a lanzar el script." }

Remove-Item -Recurse -Force $salida
Write-Host "`n✔ «$Titulo» lista." -ForegroundColor Green
Write-Host "   Enlace (para Mi enlace):  $base/master.m3u8"
Write-Host "   Para borrarla después:    borrar-pelicula.cmd $id"
Read-Host "`nPulsa Enter para cerrar"
