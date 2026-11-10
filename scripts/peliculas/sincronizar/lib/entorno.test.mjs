import { describe, expect, it } from "vitest";
import { expandir, refrescarPath, unirPath, valorDeReg } from "./entorno.mjs";

describe("PATH de verdad en Windows", () => {
  it("lee el valor de `reg query`", () => {
    const salida = "\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    %USERPROFILE%\\AppData\\Local\\Microsoft\\WindowsApps;C:\\Tools\r\n\r\n";
    expect(valorDeReg(salida)).toBe("%USERPROFILE%\\AppData\\Local\\Microsoft\\WindowsApps;C:\\Tools");
    expect(valorDeReg("ERROR: no existe")).toBe("");
  });

  it("expande %VARIABLES% sin distinguir mayúsculas y deja las que no existen", () => {
    expect(expandir("%LocalAppData%\\x;%NOEXISTE%\\y", { LOCALAPPDATA: "C:\\Users\\Pc\\AppData\\Local" })).toBe("C:\\Users\\Pc\\AppData\\Local\\x;%NOEXISTE%\\y");
  });

  it("une sin repetir y deja primero lo que ya había", () => {
    expect(unirPath(String.raw`C:\A;c:\b\ `.trim(), String.raw`C:\B;C:\Program Files\nodejs\;;C:\a`)).toBe(String.raw`C:\A;c:\b\;C:\Program Files\nodejs\ `.trim());
  });

  it("suma al PATH viejo del Explorador lo instalado después (Node, WinGet Links)", () => {
    const entorno = { Path: "C:\\Windows\\system32", LOCALAPPDATA: "C:\\Users\\Pc\\AppData\\Local" };
    refrescarPath(entorno, () => ["C:\\Windows\\system32;C:\\Program Files\\nodejs\\", "%LOCALAPPDATA%\\Programs\\rclone"]);
    expect(entorno.Path.split(";")).toEqual([
      "C:\\Windows\\system32",
      "C:\\Program Files\\nodejs\\",
      "C:\\Users\\Pc\\AppData\\Local\\Programs\\rclone",
      "C:\\Users\\Pc\\AppData\\Local\\Microsoft\\WinGet\\Links",
    ]);
  });
});
