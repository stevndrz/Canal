# ── Borrar una película de R2 y de «Nuestras películas» ─────────────────────
#
#   borrar-pelicula.cmd                → lista las que hay subidas
#   borrar-pelicula.cmd mi-pelicula    → la borra (pide confirmación)
#
# Los 10 GB gratis de R2 dan para dos o tres películas a la vez: al terminar de
# verla, se borra y queda sitio para la siguiente.

param([Parameter(Position = 0)][string]$Id)

$ErrorActionPreference = "Continue"   # Ver el porqué en subir-pelicula.ps1.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rutaConfig = Join-Path $env:APPDATA "CanalCasa\peliculas.json"
if (-not (Test-Path $rutaConfig)) { Write-Host "Todavía no has subido ninguna película (falta $rutaConfig)." -ForegroundColor Red; exit 1 }
$config = Get-Content $rutaConfig -Raw -Encoding UTF8 | ConvertFrom-Json
$rutaCatalogo = "$($config.Remoto):$($config.Cubo)/peliculas/catalogo.json"

$actual = & rclone cat $rutaCatalogo --s3-no-check-bucket 2>$null | Out-String
$lista = @()
if ($LASTEXITCODE -eq 0 -and $actual.Trim()) { $lista = @((ConvertFrom-Json $actual).peliculas) }

if (-not $Id) {
    Write-Host "`nPelículas subidas:" -ForegroundColor Cyan
    if ($lista.Count -eq 0) { Write-Host "   (ninguna)" }
    foreach ($p in $lista) { Write-Host ("   {0,-30} {1}" -f $p.id, $p.titulo) }
    $tamano = & rclone size "$($config.Remoto):$($config.Cubo)/peliculas" --s3-no-check-bucket 2>$null | Out-String
    Write-Host "`n$tamano"
    Write-Host "Para borrar una:  borrar-pelicula.cmd <nombre de la primera columna>"
    exit 0
}

$pelicula = @($lista | Where-Object { $_.id -eq $Id })[0]
$nombre = $Id; if ($pelicula) { $nombre = $pelicula.titulo }
$respuesta = Read-Host "¿Borrar «$nombre» de R2? Se deja de poder ver en todos los aparatos. (s/n)"
if ($respuesta -notmatch "^[sS]") { Write-Host "No se borró nada."; exit 0 }

& rclone purge "$($config.Remoto):$($config.Cubo)/peliculas/$Id" --s3-no-check-bucket
if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo borrar la carpeta (¿ya no estaba?)." -ForegroundColor Yellow }

$resto = @($lista | Where-Object { $_ -and $_.id -ne $Id })
$temporal = Join-Path $env:TEMP "canalcasa-catalogo.json"
$json = ConvertTo-Json -Depth 6 -InputObject ([pscustomobject]@{ version = 1; peliculas = $resto })
[System.IO.File]::WriteAllText($temporal, $json, (New-Object System.Text.UTF8Encoding($false)))
& rclone copyto $temporal $rutaCatalogo --s3-no-check-bucket --header-upload "Content-Type: application/json; charset=utf-8" --header-upload "Cache-Control: no-cache"
if ($LASTEXITCODE -ne 0) { Write-Host "Se borró la película pero no se pudo actualizar el catálogo." -ForegroundColor Red; exit 1 }
Write-Host "✔ Borrada." -ForegroundColor Green
