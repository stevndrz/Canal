# ── Empaquetar e instalar CanalCasa en Tizen, de un tirón (v2, sin adivinar rutas) ──

Write-Host "Buscando tizen.bat y sdb.bat en todo C:\ (tarda un par de minutos)..." -ForegroundColor Yellow
$encontrados = Get-ChildItem -Path "C:\" -Include "tizen.bat","sdb.bat" -Recurse -ErrorAction SilentlyContinue -Depth 8
$tizenBat = ($encontrados | Where-Object { $_.Name -eq "tizen.bat" } | Select-Object -First 1).FullName
$sdbBat   = ($encontrados | Where-Object { $_.Name -eq "sdb.bat" }   | Select-Object -First 1).FullName

if (-not $tizenBat) { Write-Host "No encontré tizen.bat en todo C:\. Algo falta instalar todavía." -ForegroundColor Red; exit 1 }
if (-not $sdbBat)   { Write-Host "No encontré sdb.bat en todo C:\. Falta el paquete de herramientas en Package Manager." -ForegroundColor Red; exit 1 }

Write-Host "tizen: $tizenBat" -ForegroundColor Green
Write-Host "sdb:   $sdbBat" -ForegroundColor Green

Write-Host "`n--- Conectando la tele ---" -ForegroundColor Cyan
& $sdbBat connect 192.168.1.25:26101
& $sdbBat devices

Write-Host "`n--- Perfiles de certificado ---" -ForegroundColor Cyan
& $tizenBat security-profiles list

$proyecto = "C:\Users\Pc\Documents\Proyectos\Canal\tizen-tv\CanalCasa"
Set-Location $proyecto
Write-Host "`n--- Compilando ---" -ForegroundColor Cyan
& $tizenBat build-web -- .

$perfil = Read-Host "`nEscribe el nombre EXACTO del perfil de la lista de arriba"
Write-Host "`n--- Empaquetando ---" -ForegroundColor Cyan
& $tizenBat package -t wgt -s $perfil -- .buildResult

$dispositivo = (& $sdbBat devices) | Select-String -Pattern "\sdevice$" | ForEach-Object { ($_ -split "\s+")[0] } | Select-Object -First 1
if (-not $dispositivo) {
    Write-Host "`nNo veo la tele conectada. Pega aquí lo que imprimió 'sdb devices' arriba." -ForegroundColor Red
    exit 1
}
Write-Host "`n--- Instalando en $dispositivo ---" -ForegroundColor Cyan
Set-Location ".buildResult"
& $tizenBat install -n "CanalCasa.wgt" -t $dispositivo

Write-Host "`nListo." -ForegroundColor Green
