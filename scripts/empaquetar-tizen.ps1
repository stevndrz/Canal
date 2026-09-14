# ── Empaquetar e instalar CanalCasa en Tizen, de un tirón ─────────────────

# 1. Encontrar tizen.bat: primero en los sitios más probables (rápido),
#    y si no aparece, busca en todo C:\ (más lento, es el respaldo).
$candidatos = @(
    "C:\tizen-studio\tools\tizen.bat",
    "$env:USERPROFILE\tizen-studio\tools\tizen.bat",
    "C:\Program Files\Tizen Studio\tools\tizen.bat",
    "C:\Program Files (x86)\Tizen Studio\tools\tizen.bat",
    "C:\Program Files\Tizen SDK\tools\tizen.bat",
    "$env:USERPROFILE\Tizen SDK\tools\tizen.bat"
)
$tizenBat = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $tizenBat) {
    Write-Host "No lo encontré en los sitios comunes, buscando en todo C:\ (puede tardar)..." -ForegroundColor Yellow
    $tizenBat = (Get-ChildItem -Path "C:\" -Filter "tizen.bat" -Recurse -Depth 6 -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}

if (-not $tizenBat) {
    Write-Host "No encontré tizen.bat en ningún lado. Búscalo a mano y avísame la ruta." -ForegroundColor Red
    exit 1
}

$tizenDir = Split-Path $tizenBat
$sdbBat = Join-Path $tizenDir "sdb.bat"
Write-Host "Tizen CLI: $tizenBat" -ForegroundColor Green

# 2. Conectar la tele (no pasa nada si ya estaba conectada).
Write-Host "`n--- Conectando la tele ---" -ForegroundColor Cyan
& $sdbBat connect 192.168.1.25

# 3. Perfiles de certificado disponibles: aquí es donde necesito que mires
#    la lista y me digas cuál usar.
Write-Host "`n--- Perfiles de certificado disponibles ---" -ForegroundColor Cyan
& $tizenBat security-profiles list

# 4. Ir al proyecto y compilar.
$proyecto = "C:\Users\Pc\Documents\Proyectos\Canal\tizen-tv\CanalCasa"
Set-Location $proyecto
Write-Host "`n--- Compilando (tizen build-web) ---" -ForegroundColor Cyan
& $tizenBat build-web -- .

# 5. Empaquetar: pide el nombre EXACTO del perfil que salió en el paso 3.
$perfil = Read-Host "`nEscribe el nombre EXACTO del perfil de la lista de arriba"
Write-Host "`n--- Empaquetando (tizen package) ---" -ForegroundColor Cyan
& $tizenBat package -t wgt -s $perfil -- .buildResult

# 6. Detectar la tele conectada e instalar ahí.
$dispositivo = (& $sdbBat devices) | Select-String -Pattern "\sdevice$" | ForEach-Object { ($_ -split "\s+")[0] } | Select-Object -First 1
if (-not $dispositivo) {
    Write-Host "`nNo veo ninguna tele conectada por sdb. Revisa 'sdb devices' a mano." -ForegroundColor Red
    exit 1
}
Write-Host "`n--- Instalando en $dispositivo ---" -ForegroundColor Cyan
& $tizenBat install -n CanalCasa.wgt -t $dispositivo

Write-Host "`nListo. Si algo falló arriba, mándame el texto completo." -ForegroundColor Green
