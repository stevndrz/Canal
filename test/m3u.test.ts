import assert from "node:assert/strict";
import test from "node:test";
import { parseM3uChannels } from "../src/lib/m3u";

test("parseM3uChannels keeps only playable entries and maps M3U metadata", () => {
  const channels = parseM3uChannels(`#EXTM3U
#EXTINF:-1 tvg-logo="https://example.com/logo.png" group-title="Noticias",Canal Uno
https://example.com/canal-uno.m3u8
#EXTINF:-1 group-title="Sin URL",Canal Dos
`);

  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, "Canal Uno");
  assert.equal(channels[0].number, "1");
  assert.equal(channels[0].category, "Noticias");
  assert.equal(channels[0].logoUrl, "https://example.com/logo.png");
  assert.equal(channels[0].streamUrl, "https://example.com/canal-uno.m3u8");
});
