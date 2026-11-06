# ── Poner al día el PC para subir películas ─────────────────────────────────
#
#   Desde la carpeta del repo:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\peliculas\preparar-pc.ps1
#
# Qué hace, preguntando antes de todo lo que borra:
#   1. Guarda tus cambios locales en un respaldo (git stash), no los borra.
#   2. Trae lo último de la rama (por defecto ver-juntos; main cuando se fusione).
#   3. Limpia lo viejo: .next, la copia de trabajo de Temp\canalcasa, ramas ya
#      fusionadas y archivos sueltos que Git no conoce (te enseña la lista).
#      NUNCA toca lo que Git ignora a propósito: tizen-tv\ (tus certificados de
#      Samsung), los .env (claves), node_modules ni los instalables.
#   4. Crea Descargas\Peliculas con «Subir pelicula.cmd» y «Borrar pelicula.cmd»,
#      para hacerlo todo desde ahí con doble clic.
#   5. Comprueba ffmpeg, rclone y la conexión con R2.

param([string]$Rama = "ver-juntos")

$ErrorActionPreference = "Continue"   # Ver el porqué en subir-pelicula.ps1.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Paso($t) { Write-Host "`n── $t" -ForegroundColor Cyan }
function Bien($t) { Write-Host "   ✔ $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "   ⚠ $t" -ForegroundColor Yellow }
function Si($pregunta) { return (Read-Host "   $pregunta (s/n)") -match "^[sS]" }

# El repo es la carpeta dos niveles por encima de este script.
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repo
if (-not (Test-Path (Join-Path $repo ".git"))) { Write-Host "No encuentro el repo en $repo" -ForegroundColor Red; exit 1 }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "No encuentro git. Instálalo: winget install Git.Git" -ForegroundColor Red; exit 1 }
Write-Host "Repo: $repo"

# ── 1. Cambios locales: a un respaldo, no a la basura ───────────────────────
Paso "Cambios locales"
$cambios = @(& git status --porcelain --untracked-files=no)
if ($cambios.Count -gt 0) {
    $cambios | ForEach-Object { Write-Host "     $_" }
    $nombre = "respaldo antes de preparar-pc " + (Get-Date -Format "yyyy-MM-dd HH:mm")
    & git stash push -m $nombre | Out-Null
    if ($LASTEXITCODE -eq 0) { Bien "Guardados en un respaldo («$nombre»). Para recuperarlos: git stash list / git stash pop" }
    else { Write-Host "   No se pudieron guardar. No sigo, para no perder nada." -ForegroundColor Red; exit 1 }
} else { Bien "No hay cambios sin guardar." }

# ── 2. Lo último de GitHub ──────────────────────────────────────────────────
Paso "Trayendo lo último ($Rama)"
& git fetch --prune origin
& git checkout $Rama
& git pull --ff-only origin $Rama
if ($LASTEXITCODE -ne 0) {
    Aviso "Tu copia de '$Rama' tiene commits que GitHub no tiene, y no la piso. Pásale a Claude Code la salida de: git log --oneline origin/$Rama..$Rama"
} else { Bien "Al día: $(& git log --oneline -1)" }

# ── 3. Limpieza ─────────────────────────────────────────────────────────────
Paso "Limpieza"
foreach ($carpeta in @((Join-Path $repo ".next"), (Join-Path $env:TEMP "canalcasa"))) {
    if (Test-Path $carpeta) {
        $gb = (Get-ChildItem -Recurse -Force $carpeta -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1GB
        Remove-Item -Recurse -Force $carpeta -ErrorAction SilentlyContinue
        Bien ("Borrada {0} ({1:N1} GB)" -f $carpeta, $gb)
    }
}

# Archivos que Git no conoce y que NO están ignorados (lo ignorado no se mira).
$sueltos = @(& git clean -n -d | ForEach-Object { $_ -replace "^Would remove ", "" })
if ($sueltos.Count -gt 0) {
    Write-Host "   Archivos sueltos que no son del repo:"
    $sueltos | ForEach-Object { Write-Host "     $_" }
    if (Si "¿Borrarlos?") { & git clean -f -d | Out-Null; Bien "Borrados." } else { Bien "Se quedan." }
} else { Bien "No hay archivos sueltos." }

# Ramas locales que ya están en main en GitHub.
$fusionadas = @(& git branch --merged origin/main | ForEach-Object { $_.Trim().TrimStart("* ").Trim() } | Where-Object { $_ -and $_ -ne "main" -and $_ -ne $Rama })
if ($fusionadas.Count -gt 0) {
    Write-Host "   Ramas locales ya fusionadas en main: $($fusionadas -join ', ')"
    if (Si "¿Borrarlas? (siguen en GitHub)") { foreach ($r in $fusionadas) { & git branch -d $r | Out-Null }; Bien "Borradas." }
} else { Bien "No hay ramas viejas." }

# ── 4. La carpeta de películas ──────────────────────────────────────────────
Paso "Carpeta de películas"
$peliculas = Join-Path $env:USERPROFILE "Downloads\Peliculas"
New-Item -ItemType Directory -Force -Path (Join-Path $peliculas "subidas") | Out-Null
$scripts = Join-Path $repo "scripts\peliculas"
# Solo ASCII en los .cmd: cmd.exe lee con la página de códigos del sistema y
# una «í» se rompería.
$subir = "@echo off`r`nrem Sube pelicula.mkv (o .mp4) de esta carpeta. Tambien puedes arrastrar un archivo encima.`r`npowershell -NoProfile -ExecutionPolicy Bypass -File `"$scripts\subir-pelicula.ps1`" %*`r`n"
$borrar = "@echo off`r`nrem Lista lo subido a R2 y pregunta cual borrar.`r`npowershell -NoProfile -ExecutionPolicy Bypass -File `"$scripts\borrar-pelicula.ps1`" %*`r`npause`r`n"
[System.IO.File]::WriteAllText((Join-Path $peliculas "Subir pelicula.cmd"), $subir, [System.Text.Encoding]::ASCII)
$agregar = "@echo off`r`nrem Anade un .srt a una pelicula ya subida. Tambien puedes arrastrar el .srt encima.`r`npowershell -NoProfile -ExecutionPolicy Bypass -File `"$scripts\agregar-subtitulos.ps1`" %*`r`n"
[System.IO.File]::WriteAllText((Join-Path $peliculas "Borrar pelicula.cmd"), $borrar, [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText((Join-Path $peliculas "Agregar subtitulos.cmd"), $agregar, [System.Text.Encoding]::ASCII)
Bien "Listo: $peliculas"
Write-Host "     · Subir pelicula.cmd   → doble clic sube pelicula.mkv de esa carpeta"
Write-Host "     · Borrar pelicula.cmd  → doble clic: lista lo que hay en R2, el espacio usado, y pregunta cuál borrar"
Write-Host "     · Agregar subtitulos.cmd → añade un .srt a una película ya subida, sin reconvertirla"
Write-Host "     · subidas\             → ahí van las que ya se subieron"

# ── 5. Herramientas y R2 ────────────────────────────────────────────────────
Paso "Comprobaciones"
foreach ($h in @("ffmpeg", "ffprobe", "rclone")) {
    if (Get-Command $h -ErrorAction SilentlyContinue) { Bien "$h instalado" }
    else { Aviso "Falta $h → winget install $(if ($h -eq 'rclone') { 'Rclone.Rclone' } else { 'Gyan.FFmpeg' })" }
}
if (Get-Command rclone -ErrorAction SilentlyContinue) {
    & rclone lsd r2:canalcasa-peliculas --s3-no-check-bucket 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Bien "Conexión con R2 (r2:canalcasa-peliculas)" }
    else { Aviso "rclone no llega a r2:canalcasa-peliculas. Revisa el remoto con: rclone config show r2" }
}

Write-Host "`n✔ Todo listo. Ahora:" -ForegroundColor Green
Write-Host "   1. Mueve la película a $peliculas y llámala pelicula.mkv (o .mp4)."
Write-Host "   2. Doble clic en «Subir pelicula.cmd» de esa carpeta."
Read-Host "`nPulsa Enter para cerrar"
