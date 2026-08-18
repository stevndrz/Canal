import assert from "node:assert/strict";
import test from "node:test";
import { getConfiguredM3uSources, normalizeM3uCategory, parseM3uChannels } from "../src/lib/m3u";

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

test("getConfiguredM3uSources accepts multiple URLs and paths", () => {
  const previousUrls = process.env.M3U_URLS;
  const previousUrl = process.env.M3U_URL;
  const previousPaths = process.env.M3U_PATHS;
  const previousPath = process.env.M3U_PATH;

  process.env.M3U_URLS = "https://example.com/a.m3u,https://example.com/b.m3u";
  process.env.M3U_URL = "https://example.com/c.m3u";
  process.env.M3U_PATHS = "/tmp/a.m3u\n/tmp/b.m3u";
  process.env.M3U_PATH = "/tmp/c.m3u";

  const sources = getConfiguredM3uSources();

  assert.deepEqual(sources.slice(0, 6), [
    "https://example.com/a.m3u",
    "https://example.com/b.m3u",
    "https://example.com/c.m3u",
    "/tmp/a.m3u",
    "/tmp/b.m3u",
    "/tmp/c.m3u",
  ]);

  process.env.M3U_URLS = previousUrls;
  process.env.M3U_URL = previousUrl;
  process.env.M3U_PATHS = previousPaths;
  process.env.M3U_PATH = previousPath;
});
