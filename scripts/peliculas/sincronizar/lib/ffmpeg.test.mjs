import { describe, expect, it } from "vitest";
import { analizar, argumentosHls, argumentosVideo, esUtf8, maestraConNombres, modosAProbar, subtitulosInternos } from "./ffmpeg.mjs";

const sonda = (video, extra = []) => ({
  format: { duration: "8760.4", tags: { title: "Catching Fire" } },
  streams: [
    { index: 0, codec_type: "video", codec_name: "h264", pix_fmt: "yuv420p", width: 1920, level: 40, ...video },
    { index: 1, codec_type: "audio", codec_name: "ac3", channels: 6, tags: { language: "eng" } },
    { index: 2, codec_type: "audio", codec_name: "aac", channels: 2, tags: { language: "spa", title: "Latino" } },
    ...extra,
  ],
});

describe("analizar", () => {
  it("H.264 1080p de 8 bits se copia; el audio principal va primero", () => {
    const a = analizar(sonda({}));
    expect(a.copiable).toBe(true);
    expect(a.audios.map((x) => x.index)).toEqual([2, 1]);
    expect(a.duracion).toBe(8760);
    expect(a.tituloInterno).toBe("Catching Fire");
  });
  it("H.265 10 bits 4K HDR se recodifica, y dice por qué", () => {
    const a = analizar(sonda({ codec_name: "hevc", pix_fmt: "yuv420p10le", width: 3840, color_transfer: "smpte2084" }));
    expect(a.copiable).toBe(false);
    expect(a.motivos).toEqual(["hevc", "yuv420p10le", "más de 1080p", "HDR"]);
  });
  it("sin vídeo o sin audio, falla con un mensaje claro", () => {
    expect(() => analizar({ streams: [] })).toThrow(/no tiene vídeo/);
    expect(() => analizar({ streams: [{ index: 0, codec_type: "video" }] })).toThrow(/no tiene audio/);
  });
});

describe("modos y argumentos", () => {
  it("con NVIDIA: nvidia, nvidia sin extras y la CPU de respaldo", () => {
    const a = analizar(sonda({ codec_name: "hevc" }));
    expect(modosAProbar(a, { funciona: (n) => n === "h264_nvenc" })).toEqual(["nvidia", "nvidia-basico", "cpu"]);
    expect(modosAProbar(analizar(sonda({})))).toEqual(["copiar"]);
    expect(modosAProbar(analizar(sonda({})), { recodificar: true, aceleracion: "cpu" })).toEqual(["cpu"]);
  });
  it("los argumentos llevan el fotograma clave cada 6 s y el techo de bitrate", () => {
    const args = argumentosVideo("nvidia", { calidad: 24 });
    expect(args).toEqual(expect.arrayContaining(["h264_nvenc", "-cq", "24", "-maxrate", "6M", "expr:gte(t,n_forced*6)"]));
    expect(argumentosVideo("copiar")).toEqual(["-c:v", "copy"]);
  });
  it("el HLS lleva todos los audios, el principal por defecto", () => {
    const args = argumentosHls(analizar(sonda({})), ["-c:v", "copy"]);
    const mapa = args[args.indexOf("-var_stream_map") + 1];
    expect(mapa).toBe("v:0,agroup:aud,name:video a:0,agroup:aud,language:spa,name:a0,default:yes a:1,agroup:aud,language:eng,name:a1");
  });
  it("pone el nombre de verdad a cada audio en la lista maestra", () => {
    const maestra = [
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="group_aud",NAME="audio_0",DEFAULT=YES,URI="a0/index.m3u8"',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="group_aud",NAME="audio_1",DEFAULT=NO,URI="a1/index.m3u8"',
    ].join("\n");
    const salida = maestraConNombres(maestra, analizar(sonda({})));
    expect(salida).toContain('NAME="Latino"');
    expect(salida).toContain('NAME="Inglés"');
  });
});

describe("subtítulos", () => {
  it("se quedan los de texto de los idiomas pedidos, y se cuentan los de imagen", () => {
    const a = analizar(
      sonda({}, [
        { index: 3, codec_type: "subtitle", codec_name: "subrip", tags: { language: "spa" }, disposition: { forced: 1 } },
        { index: 4, codec_type: "subtitle", codec_name: "hdmv_pgs_subtitle", tags: { language: "eng" } },
        { index: 5, codec_type: "subtitle", codec_name: "subrip", tags: { language: "fre" } },
      ]),
    );
    const { elegidos, imagenes } = subtitulosInternos(a, ["spa", "eng"]);
    expect(elegidos).toEqual([{ index: 3, idioma: "spa", srclang: "es", etiqueta: "Español (forzados)" }]);
    expect(imagenes).toBe(1);
  });
  it("distingue UTF-8 de Windows-1252", () => {
    expect(esUtf8(Buffer.from("año", "utf8"))).toBe(true);
    expect(esUtf8(Buffer.from([0x61, 0xf1, 0x6f]))).toBe(false);
  });
});
