@echo off
rem Sincroniza Descargas\Peliculas con la nube (R2). Ver docs\PELICULAS-JUNTOS.md
rem Opciones: --mirar (solo ensena el plan), --calidad 26, --carpeta "C:\otra"...
chcp 65001 >nul
where node >nul 2>nul || (echo Falta Node.js. Ejecuta preparar-pc.ps1 o: winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
node "%~dp0sincronizar\sincronizar.mjs" %*
