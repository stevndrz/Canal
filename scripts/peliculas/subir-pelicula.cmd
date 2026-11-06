@echo off
rem Doble clic: sube Descargas\Peliculas\pelicula.mkv (o .mp4).
rem O arrastra cualquier archivo encima. Ver docs\PELICULAS-JUNTOS.md
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0subir-pelicula.ps1" %*
