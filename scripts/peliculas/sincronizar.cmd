@echo off
rem Sincroniza Descargas\Peliculas con la nube (R2). Ver docs\PELICULAS-JUNTOS.md
rem Opciones: --mirar (solo ensena el plan), --calidad 26, --carpeta "C:\otra"...
chcp 65001 >nul
set "YA_INSTALE="
:buscar
call "%~dp0buscar-node.cmd"
if not defined NODE_EXE goto sin_node
"%NODE_EXE%" "%~dp0sincronizar\sincronizar.mjs" %*
if errorlevel 1 pause
exit /b

:sin_node
if defined YA_INSTALE goto manual
echo.
echo  No encuentro Node.js 20 o mas nuevo (lo necesita CanalCasa).
where winget >nul 2>nul || goto manual
choice /c SN /m " Lo instalo ahora con winget"
if errorlevel 2 goto manual
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
set "YA_INSTALE=1"
goto buscar

:manual
echo.
echo  Instala Node.js LTS desde https://nodejs.org (Siguiente a todo)
echo  y vuelve a hacer doble clic aqui. No hace falta reiniciar.
pause
exit /b 1
