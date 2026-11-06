@echo off
rem Uso: borrar-pelicula.cmd nombre-de-la-carpeta   (sin nada: lista las que hay)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0borrar-pelicula.ps1" %*
pause
