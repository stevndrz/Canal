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
#   4. Crea Descargas\Peliculas con «Sincronizar peliculas.cmd»: lo que dejes
#      en esa carpeta queda en la nube y en la app (ver docs/PELICULAS-JUNTOS.md).
#   5. Comprueba Node, ffmpeg, rclone y la conexión con R2 (y ofrece instalar
#      lo que falte con winget).

param([string]$Rama = "main")

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
New-Item -ItemType Directory -Force -Path $peliculas | Out-Null
$scripts = Join-Path $repo "scripts\peliculas"
# Solo ASCII en los .cmd: cmd.exe lee con la página de códigos del sistema y
# una «í» se rompería.
$sincronizar = "@echo off`r`nrem Deja la nube igual que esta carpeta. Ver docs\PELICULAS-JUNTOS.md`r`ncall `"$scripts\sincronizar.cmd`" %*`r`n"
$mirar = "@echo off`r`nrem Ensena lo que haria Sincronizar, sin hacer nada.`r`ncall `"$scripts\sincronizar.cmd`" --mirar %*`r`n"
[System.IO.File]::WriteAllText((Join-Path $peliculas "Sincronizar peliculas.cmd"), $sincronizar, [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText((Join-Path $peliculas "Mirar que cambiaria.cmd"), $mirar, [System.Text.Encoding]::ASCII)
$panel = "@echo off`r`nrem Panel con botones: agregar, subir y borrar peliculas. Ver docs\PELICULAS-JUNTOS.md`r`ncall `"$scripts\panel.cmd`" %*`r`n"
[System.IO.File]::WriteAllText((Join-Path $peliculas "CanalCasa Peliculas.cmd"), $panel, [System.Text.Encoding]::ASCII)
$sola = "@echo off`r`nrem Activa o quita la sincronizacion automatica (cada 10 minutos, sin ventana).`r`ncall `"$scripts\sincronizar-sola.cmd`" %*`r`n"
[System.IO.File]::WriteAllText((Join-Path $peliculas "Sincronizar sola (activar o quitar).cmd"), $sola, [System.Text.Encoding]::ASCII)
Bien "Listo: $peliculas"
Write-Host "     · CanalCasa Peliculas.cmd   → el panel con botones (agregar, subir, borrar)"
Write-Host "     · Sincronizar peliculas.cmd → lo que hay en esta carpeta, a la nube (pregunta antes de borrar)"
Write-Host "     · Mirar que cambiaria.cmd   → enseña el plan sin hacer nada"
Write-Host "     · Sincronizar sola (activar o quitar).cmd → que lo haga Windows cada 10 minutos (nunca borra)"

# Los accesos de antes ya no hacen falta: «Sincronizar» sube, cambia
# subtítulos y borra. Se pregunta antes de quitarlos (los scripts siguen en el repo).
$viejos = @("Subir pelicula.cmd", "Borrar pelicula.cmd", "Agregar subtitulos.cmd") | ForEach-Object { Join-Path $peliculas $_ } | Where-Object { Test-Path -LiteralPath $_ }
if ($viejos.Count -gt 0) {
    Write-Host "   Accesos de antes: $(($viejos | ForEach-Object { Split-Path -Leaf $_ }) -join ', ')"
    if (Si "¿Quitarlos de la carpeta? (los scripts siguen en el repo)") { $viejos | ForEach-Object { Remove-Item -LiteralPath $_ }; Bien "Quitados." }
}

# ── 5. Herramientas y R2 ────────────────────────────────────────────────────
Paso "Comprobaciones"
# Node 20 o más: lo usa «Sincronizar peliculas».
$versionNode = 0
if (Get-Command node -ErrorAction SilentlyContinue) { $versionNode = [int](((& node --version) -replace "^v", "") -split "\.")[0] }
if ($versionNode -ge 20) { Bien "Node $versionNode instalado" }
elseif (Si "Falta Node 20 o más (lo usa Sincronizar). ¿Lo instalo con winget?") {
    & winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    Aviso "Cierra esta ventana y abre otra para que Windows encuentre «node»."
} else { Aviso "Sin Node no funciona Sincronizar. Para instalarlo: winget install OpenJS.NodeJS.LTS" }

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
Write-Host "   1. Deja la película en $peliculas tal como venga (con sus .srt al lado, o en su propia carpeta)."
Write-Host "   2. Doble clic en «CanalCasa Peliculas.cmd» de esa carpeta (o en «Sincronizar peliculas.cmd»)."
Read-Host "`nPulsa Enter para cerrar"
