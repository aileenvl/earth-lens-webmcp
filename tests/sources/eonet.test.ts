import assert from "node:assert/strict";
import test from "node:test";

import { fetchEonetEvidence, getEonetEventsUrl, normalizeEonetEvents } from "../../app/sources/eonet.ts";

const event = {
  id: "EONET_1", title: "Wildfire Example", closed: null,
  categories: [{ id: "wildfires", title: "Wildfires" }],
  sources: [{ id: "IRWIN", url: "https://example.gov/event/1" }],
  geometry: [{ date: "2026-08-29T12:00:00Z", type: "Point", coordinates: [-117.3, 41.8], magnitudeValue: 10, magnitudeUnit: "acres" }],
};

test("builds the documented v3 status, days, limit, and bbox query", () => {
  const url = new URL(getEonetEventsUrl({ status: "all", days: 30, limit: 50, bbox: [-110, 40, -100, 20] }));
  assert.equal(url.pathname, "/api/v3/events");
  assert.deepEqual(Object.fromEntries(url.searchParams), { status: "all", days: "30", limit: "50", bbox: "-110,40,-100,20" });
});

test("normalizes the latest dated point with origin provenance and limitation", () => {
  const result = normalizeEonetEvents({ events: [event] }, "2026-08-30T12:00:00.000Z");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value[0].sourceUrl, "https://example.gov/event/1");
  assert.deepEqual(result.value[0].coordinates, { latitude: 41.8, longitude: -117.3 });
  assert.match(result.value[0].limitation, /not official alerts/);
});

test("safely omits polygon-only events and rejects malformed point geometry", () => {
  const polygon = { ...event, geometry: [{ date: "2026-08-29T12:00:00Z", type: "Polygon", coordinates: [[[-1, 1], [1, 1], [1, -1], [-1, 1]]] }] };
  const omitted = normalizeEonetEvents({ events: [polygon] }, "2026-08-30T12:00:00.000Z");
  assert.equal(omitted.ok && omitted.value.length, 0);
  const malformed = { ...event, geometry: [{ date: "bad", type: "Point", coordinates: [null, 1] }] };
  assert.equal(normalizeEonetEvents({ events: [malformed] }, "2026-08-30T12:00:00.000Z").ok, false);
});

test("returns independent empty, malformed, and aborted states", async () => {
  const empty = await fetchEonetEvidence({}, { fetchImpl: async () => new Response(JSON.stringify({ events: [] })) });
  assert.equal(empty.status, "empty");
  const malformed = await fetchEonetEvidence({}, { fetchImpl: async () => new Response(JSON.stringify({ events: [{}] })) });
  assert.equal(malformed.status, "unavailable");
  const controller = new AbortController(); controller.abort();
  const aborted = await fetchEonetEvidence({}, { signal: controller.signal, fetchImpl: async (_url, init) => { throw new DOMException(String(init?.signal?.aborted), "AbortError"); } });
  assert.equal(aborted.status, "unavailable");
  if (aborted.status === "unavailable") assert.equal(aborted.code, "ABORTED");
});
