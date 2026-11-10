/**
 * Las ventanas de Windows que el navegador no puede abrir por su cuenta: el
 * selector de archivos (con su ruta de verdad, que un <input type=file> no
 * da), el de carpetas y la Papelera.
 *
 * Se hacen con PowerShell y un script FIJO (`-EncodedCommand`): lo que elija
 * la persona viaja por stdin/stdout en JSON, nunca pegado dentro del código,
 * así que un archivo con comillas o `;` en el nombre no puede ejecutar nada.
 *
 * Para probar sin Windows: CANALCASA_DIALOGOS_FALSOS=<archivo.json> con
 *   { "archivos": ["…"], "subtitulos": ["…"], "carpeta": "…", "papelera": "<carpeta>" }
 * y `crearDialogosFalsos` mueve a esa carpeta en vez de a la Papelera.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import { basename, join } from "node:path";

const COMUN = `
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$entrada = [Console]::In.ReadToEnd() | ConvertFrom-Json
# Una ventana invisible siempre encima: así el selector sale delante del navegador.
$duena = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false; Opacity = 0 }
$duena.Show(); $duena.Activate()
`;

const SCRIPTS = {
  archivos: `${COMUN}
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = $entrada.titulo
$d.Multiselect = $true
$d.Filter = $entrada.filtro
if ($entrada.inicio -and (Test-Path -LiteralPath $entrada.inicio)) { $d.InitialDirectory = $entrada.inicio }
$r = @()
if ($d.ShowDialog($duena) -eq [System.Windows.Forms.DialogResult]::OK) { $r = @($d.FileNames) }
ConvertTo-Json -InputObject @($r) -Compress
`,
  carpeta: `${COMUN}
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = $entrada.titulo
$d.ShowNewFolderButton = $true
if ($entrada.inicio -and (Test-Path -LiteralPath $entrada.inicio)) { $d.SelectedPath = $entrada.inicio }
$r = ""
if ($d.ShowDialog($duena) -eq [System.Windows.Forms.DialogResult]::OK) { $r = $d.SelectedPath }
ConvertTo-Json -InputObject $r -Compress
`,
  papelera: `
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName Microsoft.VisualBasic
$entrada = [Console]::In.ReadToEnd() | ConvertFrom-Json
$hechos = @()
foreach ($ruta in @($entrada.rutas)) {
  if (Test-Path -LiteralPath $ruta -PathType Container) {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($ruta, 'OnlyErrorDialogs', 'SendToRecycleBin')
  } elseif (Test-Path -LiteralPath $ruta) {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($ruta, 'OnlyErrorDialogs', 'SendToRecycleBin')
  }
  $hechos += $ruta
}
ConvertTo-Json -InputObject @($hechos) -Compress
`,
};

const VIDEOS = "*.mkv;*.mp4;*.m4v;*.mov;*.avi;*.webm;*.ts";
const SUBS = "*.srt;*.vtt;*.ass;*.ssa";

function powershell(script, entrada) {
  const codificado = Buffer.from(script, "utf16le").toString("base64");
  return new Promise((resolver, rechazar) => {
    const hijo = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-EncodedCommand", codificado], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let salida = "";
    let error = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (error += d));
    hijo.on("error", rechazar);
    hijo.on("close", (codigo) => {
      if (codigo !== 0) return rechazar(new Error(`Windows no abrió la ventana: ${error.trim().split("\n").slice(-2).join(" ")}`));
      try {
        resolver(JSON.parse(salida.replace(/^﻿/, "").trim() || "null"));
      } catch {
        rechazar(new Error(`Respuesta rara de Windows: ${salida.slice(0, 200)}`));
      }
    });
    hijo.stdin.end(JSON.stringify(entrada));
  });
}

/** Las de verdad, en Windows. */
export function crearDialogosWindows() {
  return {
    elegirPeliculas: (inicio) =>
      powershell(SCRIPTS.archivos, { titulo: "Elige la película (y sus subtítulos, si quieres)", filtro: `Películas y subtítulos|${VIDEOS};${SUBS}|Todos los archivos|*.*`, inicio }),
    elegirSubtitulos: (inicio) => powershell(SCRIPTS.archivos, { titulo: "Elige los subtítulos", filtro: `Subtítulos|${SUBS}`, inicio }),
    elegirCarpeta: (inicio) => powershell(SCRIPTS.carpeta, { titulo: "Carpeta de las películas", inicio }).then((r) => r || null),
    aPapelera: (rutas) => powershell(SCRIPTS.papelera, { rutas }),
  };
}

/** Para las pruebas (y para probar el panel fuera de Windows). */
export function crearDialogosFalsos(rutaJson) {
  const leer = () => JSON.parse(readFileSync(rutaJson, "utf8"));
  return {
    elegirPeliculas: async () => leer().archivos ?? [],
    elegirSubtitulos: async () => leer().subtitulos ?? [],
    elegirCarpeta: async () => leer().carpeta ?? null,
    async aPapelera(rutas) {
      const papelera = leer().papelera;
      await mkdir(papelera, { recursive: true });
      const hechos = [];
      for (const r of rutas) {
        if (!(await stat(r).catch(() => null))) continue;
        await rename(r, join(papelera, `${Date.now()}-${basename(r)}`));
        hechos.push(r);
      }
      return hechos;
    },
  };
}

export function crearDialogos() {
  if (process.env.CANALCASA_DIALOGOS_FALSOS) return crearDialogosFalsos(process.env.CANALCASA_DIALOGOS_FALSOS);
  if (process.platform === "win32") return crearDialogosWindows();
  const no = async () => {
    throw new Error("Las ventanas para elegir archivos solo existen en Windows.");
  };
  return { elegirPeliculas: no, elegirSubtitulos: no, elegirCarpeta: no, aPapelera: no };
}
