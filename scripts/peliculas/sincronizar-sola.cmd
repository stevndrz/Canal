@echo off
rem Activa o quita la sincronizacion automatica (tarea de Windows cada 10 min).
rem Ver docs\PELICULAS-JUNTOS.md
chcp 65001 >nul
where node >nul 2>nul || (echo Falta Node.js. Ejecuta preparar-pc.ps1 o: winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
node "%~dp0sincronizar\tarea.mjs" %*
pause
