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
  assert.doesNotMatch(html, /42 min ago|18 min ago|2 hr ago/);
  assert.doesNotMatch(html, /Workspace inspected: 3 sources/);
});

test("keeps the WebMCP integration in the application source", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const registration = await readFile(new URL("../app/webmcp/register.ts", import.meta.url), "utf8");
  const toolSource = await readFile(new URL("../app/webmcp/tools.ts", import.meta.url), "utf8");
  const tools = [...toolSource.matchAll(/name:\s*"([^"]+)"/g)].map((match) => match[1]).join(" ");

  assert.match(page, /document\.modelContext/);
  assert.match(registration, /registerTool\(tool/);
  assert.match(tools, /get_workspace_state/);
  assert.match(tools, /query_selected_area/);
  assert.match(tools, /create_situation_lens_draft/);
  assert.match(tools, /focus_place/);
  assert.doesNotMatch(tools, /mark.*reviewed|publish|send/i);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});

test("draft review is a visible human-only state transition", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const lens = await readFile(new URL("../app/domain/review/lens.ts", import.meta.url), "utf8");

  assert.match(page, /reviewSituationLensDraft/);
  assert.match(page, /Reviewed by you/);
  assert.match(lens, /reviewedBy: "human"/);
});

test("keeps ArcGIS browser-only and provides non-map area controls", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const map = await readFile(new URL("../app/components/ArcgisInvestigationMap.tsx", import.meta.url), "utf8");

  assert.match(page, /ArcgisInvestigationMap/);
  assert.match(map, /https:\/\/js\.arcgis\.com\/5\.1\//);
  assert.match(map, /\$arcgis.*import/s);
  assert.match(map, /aria-label="Edit investigation area"/);
  assert.match(page, /Environmental evidence map centered on \$\{selection\.label\}/);
  assert.match(page, /areaAirQuality/);
  assert.doesNotMatch(page, /aria-label="Environmental evidence map centered on Monterrey"/);
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
  assert.match(page, /aria-label="Event history time window"/);
  assert.match(page, /Updating earthquakes and natural events/);
  assert.match(page, /Air quality stays current/);
  assert.match(page, /role="status"/);
  assert.doesNotMatch(page, /<div><span style=\{\{ width:/);
});

test("renders a real natural-language assistant form instead of a hard-coded prompt card", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const chat = await readFile(new URL("../app/components/AssistantChat.tsx", import.meta.url), "utf8");

  assert.match(page, /<AssistantChat/);
  assert.match(chat, /<form/);
  assert.match(chat, /fetch\("\/api\/chat"/);
  assert.match(chat, /Ask Earth Lens/);
  assert.match(chat, /Outdoor plans\?/);
  assert.match(chat, /Try another city/);
  assert.doesNotMatch(page, /Show environmental activity that may affect this area today/);
});

test("air quality explains its current model scope and pollutant detail", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const card = await readFile(new URL("../app/components/AirQualityCard.tsx", import.meta.url), "utf8");

  assert.match(page, /<AirQualityCard/);
  assert.match(page, /selectedAqiSummary/);
  assert.match(page, /setSelectedObservation\(\(current\) => current \?\? result\.data\.id\)/);
  assert.match(card, /getUsAqiTone/);
  assert.match(card, /aqi-\$\{tone\}/);
  assert.match(page, /Event history/);
  assert.match(card, /Current model estimate/);
  assert.match(card, /Not a sensor/);
  assert.match(card, /PM₂\.₅/);
  assert.match(card, /PM₁₀/);
  assert.match(card, /Outdoor planning cue/);
  assert.match(page, /Likely driver/);
  assert.match(page, /not a safety verdict/i);
});

test("desktop evidence and investigation rails remain scrollable within the app frame", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.rail\s*\{[^}]*overflow-y:auto[^}]*scrollbar-gutter:stable/s);
  assert.match(styles, /\.evidenceCard\s*\{[^}]*bottom:20px[^}]*overflow-y:auto[^}]*scrollbar-gutter:stable/s);
  assert.match(styles, /\.rail,\.evidenceCard\s*\{[^}]*scrollbar-color:/s);
});
