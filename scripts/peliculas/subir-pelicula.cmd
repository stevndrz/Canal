@echo off
rem Arrastra una pelicula sobre este archivo. Ver docs\PELICULAS-JUNTOS.md
if "%~1"=="" (
  echo Arrastra el archivo de la pelicula sobre subir-pelicula.cmd
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0subir-pelicula.ps1" "%~1" %2 %3 %4 %5 %6 %7 %8 %9
