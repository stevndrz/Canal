import assert from "node:assert/strict";
import test from "node:test";
import { getConfiguredM3uSource, normalizeM3uCategory, parseM3uChannels } from "../src/lib/m3u";

test("parseM3uChannels removes duplicates and sorts important categories first", () => {
  const channels = parseM3uChannels(`#EXTM3U
#EXTINF:-1 tvg-logo="https://example.com/logo.png" group-title="Sports",ESPN Deportes
https://example.com/espn.m3u8
#EXTINF:-1 tvg-id="Canal3.gt" group-title="General",Canal 3 Guatemala
https://example.com/canal-3.m3u8
#EXTINF:-1 group-title="Sports",ESPN Deportes Duplicado
https://example.com/espn.m3u8
`);

  assert.equal(channels.length, 2);
  assert.equal(channels[0].name, "Canal 3 Guatemala");
  assert.equal(channels[0].category, "Guatemala");
  assert.equal(channels[0].number, "1");
  assert.equal(channels[1].category, "Deportes");
  assert.equal(channels[1].logoUrl, "https://example.com/logo.png");
});

test("normalizeM3uCategory groups channels by content and language", () => {
  assert.equal(normalizeM3uCategory({ name: "Tigo Sports", group: "Sports" }), "Deportes");
  assert.equal(normalizeM3uCategory({ name: "BBC World News", group: "News", tvg: { language: "English" } }), "Noticias");
  assert.equal(normalizeM3uCategory({ name: "Canal Familiar", group: "Spanish" }), "Español");
});

test("getConfiguredM3uSource uses the single editable playlist source", () => {
  const previousUrl = process.env.M3U_URL;
  const previousPath = process.env.M3U_PATH;

  process.env.M3U_URL = "https://example.com/gt.m3u";
  process.env.M3U_PATH = "/tmp/gt.m3u";
  assert.equal(getConfiguredM3uSource(), "https://example.com/gt.m3u");

  delete process.env.M3U_URL;
  assert.equal(getConfiguredM3uSource(), "/tmp/gt.m3u");

  process.env.M3U_URL = previousUrl;
  process.env.M3U_PATH = previousPath;
});
