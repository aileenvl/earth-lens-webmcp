import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Earth Lens investigation shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Earth Lens — Investigate a place with your agent<\/title>/i);
  assert.match(html, /What’s happening around Monterrey\?/);
  assert.match(html, /A shared evidence workspace for you and your agent\./);
  assert.match(html, /Waiting for WebMCP browser/);
  assert.match(html, /Every observation keeps its source, freshness, and limits\./);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("keeps the WebMCP integration in the application source", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /document\.modelContext/);
  assert.match(page, /registerTool\(tool/);
  assert.match(page, /get_workspace_state/);
  assert.match(page, /query_selected_area/);
  assert.match(page, /create_situation_lens/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});

test("keeps ArcGIS browser-only and provides non-map area controls", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const map = await readFile(new URL("../app/components/ArcgisInvestigationMap.tsx", import.meta.url), "utf8");

  assert.match(page, /ArcgisInvestigationMap/);
  assert.match(map, /https:\/\/js\.arcgis\.com\/5\.1\//);
  assert.match(map, /\$arcgis.*import/s);
  assert.match(map, /aria-label="Edit investigation area"/);
  assert.match(map, /Latitude/);
  assert.match(map, /Radius \(km\)/);
  assert.doesNotMatch(map, /^import .*@arcgis/m);
});
