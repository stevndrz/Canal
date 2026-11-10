@echo off
rem Busca un Node.js 20 o mas nuevo y deja su ruta completa en NODE_EXE.
rem No depende de que Windows haya refrescado el PATH: prueba primero las
rem carpetas donde lo instalan winget y el instalador de nodejs.org, y cada
rem candidato se ejecuta de verdad (--version) antes de darlo por bueno.
rem Sin parentesis alrededor de las rutas: %ProgramFiles(x86)% los rompe.
set "NODE_EXE="
call :probar "%ProgramFiles%\nodejs\node.exe"
if defined NODE_EXE exit /b 0
call :probar "%LOCALAPPDATA%\Programs\nodejs\node.exe"
if defined NODE_EXE exit /b 0
call :probar "%ProgramFiles(x86)%\nodejs\node.exe"
if defined NODE_EXE exit /b 0
if defined NVM_SYMLINK call :probar "%NVM_SYMLINK%\node.exe"
if defined NODE_EXE exit /b 0
for /f "delims=" %%i in ('where node.exe 2^>nul') do if not defined NODE_EXE call :probar "%%i"
if defined NODE_EXE exit /b 0
rem El que trae otra aplicacion, solo como ultimo recurso.
call :probar "%LOCALAPPDATA%\hermes\node\node.exe"
exit /b 0

:probar
if not exist "%~1" exit /b 1
set "VERSION_NODE="
for /f "tokens=1 delims=." %%v in ('""%~1" --version 2^>nul"') do set "VERSION_NODE=%%v"
if not defined VERSION_NODE exit /b 1
set "VERSION_NODE=%VERSION_NODE:v=%"
set /a VERSION_NODE=%VERSION_NODE% 2>nul
if %VERSION_NODE% GEQ 20 set "NODE_EXE=%~1"
exit /b 0
