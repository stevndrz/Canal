@echo off
rem Abre el panel de Nuestras peliculas en el navegador (botones para agregar,
rem subir y borrar). Ver docs\PELICULAS-JUNTOS.md
chcp 65001 >nul
where node >nul 2>nul || (echo Falta Node.js. Ejecuta preparar-pc.ps1 o: winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
node "%~dp0sincronizar\panel.mjs" %*
if errorlevel 1 pause
