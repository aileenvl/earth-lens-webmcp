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

  const html = (await response.text()).replaceAll("<!-- -->", "");
  assert.match(html, /<title>Earth Lens — Investigate a place with your agent<\/title>/i);
  assert.match(html, /What’s happening around Monterrey\?/);
  assert.match(html, /A shared evidence workspace for you and your agent\./);
  assert.match(html, /Waiting for WebMCP browser/);
  assert.match(html, /Every observation keeps its source, freshness, and limits\./);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("keeps the WebMCP integration in the application source", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const registration = await readFile(new URL("../app/webmcp/register.ts", import.meta.url), "utf8");
  const tools = await readFile(new URL("../app/webmcp/tools.ts", import.meta.url), "utf8");

  assert.match(page, /document\.modelContext/);
  assert.match(registration, /registerTool\(tool/);
  assert.match(tools, /get_workspace_state/);
  assert.match(tools, /query_selected_area/);
  assert.match(tools, /create_situation_lens_draft/);
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

test("time-window controls are real labelled controls rather than a decorative slider", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /stepTimeWindow\("previous"\)/);
  assert.match(page, /stepTimeWindow\("next"\)/);
  assert.match(page, /Choose evidence time window/);
  assert.match(page, /Choose event history window/);
  assert.doesNotMatch(page, /<div><span style=\{\{ width:/);
});

test("renders a real natural-language assistant form instead of a hard-coded prompt card", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const chat = await readFile(new URL("../app/components/AssistantChat.tsx", import.meta.url), "utf8");

  assert.match(page, /<AssistantChat/);
  assert.match(chat, /<form/);
  assert.match(chat, /fetch\("\/api\/chat"/);
  assert.match(chat, /Ask Earth Lens/);
  assert.doesNotMatch(page, /Show environmental activity that may affect this area today/);
});

test("air quality explains its current model scope and pollutant detail", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const card = await readFile(new URL("../app/components/AirQualityCard.tsx", import.meta.url), "utf8");

  assert.match(page, /<AirQualityCard/);
  assert.match(page, /selectedAqiSummary/);
  assert.match(card, /getUsAqiTone/);
  assert.match(card, /aqi-\$\{tone\}/);
  assert.match(page, /Event history/);
  assert.match(card, /Current model estimate/);
  assert.match(card, /Not a sensor/);
  assert.match(card, /PM₂\.₅/);
  assert.match(card, /PM₁₀/);
});
