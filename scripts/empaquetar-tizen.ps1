# ── Empaquetar e instalar CanalCasa en Tizen, de un tirón ──────────────────
# Rutas confirmadas a mano en esta máquina (Tizen SDK 10.0). Si algún día
# cambian, búscalas con:
#   Get-ChildItem C:\ -Include tizen.bat,sdb.exe -Recurse -ErrorAction SilentlyContinue

$tizenBat = "C:\tizen-studio\tools\ide\bin\tizen.bat"
$sdbBat   = "C:\tizen-studio\tools\sdb.exe"
$proyecto = "C:\Users\Pc\Documents\Proyectos\Canal\tizen-tv\CanalCasa"

Write-Host "`n--- Conectando la tele ---" -ForegroundColor Cyan
& $sdbBat connect 192.168.1.25:26101
& $sdbBat devices

Write-Host "`n--- Perfiles de certificado ---" -ForegroundColor Cyan
& $tizenBat security-profiles list

Set-Location $proyecto
Write-Host "`n--- Compilando ---" -ForegroundColor Cyan
& $tizenBat build-web -- .

$perfil = Read-Host "`nEscribe el nombre EXACTO del perfil de la lista de arriba"
Write-Host "`n--- Empaquetando ---" -ForegroundColor Cyan
& $tizenBat package -t wgt -s $perfil -- .buildResult

$dispositivo = (& $sdbBat devices) | Where-Object { ($_ -split '\s+')[1] -eq 'device' } | ForEach-Object { ($_ -split '\s+')[0] } | Select-Object -First 1
if (-not $dispositivo) {
    Write-Host "`nNo veo la tele conectada. Pega aquí lo que imprimió 'sdb devices' arriba." -ForegroundColor Red
    exit 1
}
Write-Host "`n--- Instalando en $dispositivo ---" -ForegroundColor Cyan
Set-Location "$proyecto\.buildResult"
& $tizenBat install -n "CanalCasa.wgt" -t $dispositivo

Write-Host "`nListo." -ForegroundColor Green
