@echo off
rem Anade un .srt a una pelicula ya subida. Arrastra el .srt encima o da doble clic.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0agregar-subtitulos.ps1" %*
