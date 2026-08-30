import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  fetchUsgsEvidence,
  getUsgsFeedUrl,
  normalizeUsgsCollection,
} from "../../app/sources/usgs.ts";

const fixtureUrl = new URL("../fixtures/usgs/all-day-minimal.geojson", import.meta.url);
const fetchedAt = "2026-08-29T22:00:00.000Z";

async function fixture(): Promise<unknown> {
  return JSON.parse(await readFile(fixtureUrl, "utf8"));
}

test("maps supported windows to documented USGS summary feeds", () => {
  assert.equal(getUsgsFeedUrl("24h"), "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson");
  assert.equal(getUsgsFeedUrl("7d"), "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson");
  assert.equal(getUsgsFeedUrl("30d"), "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson");
});

test("normalizes provenance, time, coordinates, magnitude, and review status", async () => {
  const result = normalizeUsgsCollection(await fixture(), fetchedAt);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value[0], {
    id: "usgs:ci41539016",
    provider: "usgs",
    sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/ci41539016",
    coordinates: { latitude: 34.3298333333333, longitude: -116.722666666667 },
    observedAt: "2026-08-30T04:29:32.550Z",
    fetchedAt,
    evidenceType: "earthquake",
    title: "M 1.02 · 14 km NE of Big Bear City, CA",
    attributes: {
      magnitude: 1.02,
      depthKm: 1.55,
      status: "automatic",
      updatedAt: "2026-08-30T04:32:58.907Z",
      network: "ci",
      code: "41539016"
    },
    limitation: "Automatic events have not yet been reviewed by a human; USGS records may change as analysis continues."
  });
});

test("rejects invalid event timestamps and unsafe provenance URLs", async () => {
  const payload = await fixture() as { features: Array<{ properties: Record<string, unknown> }> };
  payload.features[0].properties.time = Number.MAX_VALUE;
  assert.equal(normalizeUsgsCollection(payload, fetchedAt).ok, false);

  const unsafe = await fixture() as { features: Array<{ properties: Record<string, unknown> }> };
  unsafe.features[0].properties.url = "javascript:alert(1)";
  assert.equal(normalizeUsgsCollection(unsafe, fetchedAt).ok, false);
});

test("returns independent empty, malformed, HTTP-error, aborted, and timeout states", async (t) => {
  await t.test("empty", async () => {
    const response = await fetchUsgsEvidence("24h", {
      now: () => fetchedAt,
      fetchImpl: async () => new Response(JSON.stringify({ type: "FeatureCollection", metadata: {}, features: [] })),
    });
    assert.equal(response.status, "empty");
  });

  await t.test("malformed", async () => {
    const response = await fetchUsgsEvidence("24h", {
      now: () => fetchedAt,
      fetchImpl: async () => new Response(JSON.stringify({ features: [{ id: "broken" }] })),
    });
    assert.equal(response.status, "unavailable");
    if (response.status === "unavailable") assert.equal(response.code, "INVALID_RESPONSE");
  });

  await t.test("http error", async () => {
    const response = await fetchUsgsEvidence("24h", {
      now: () => fetchedAt,
      fetchImpl: async () => new Response("upstream unavailable", { status: 503 }),
    });
    assert.equal(response.status, "unavailable");
    if (response.status === "unavailable") assert.equal(response.code, "HTTP_ERROR");
  });

  await t.test("caller abort", async () => {
    const controller = new AbortController();
    controller.abort("superseded");
    const response = await fetchUsgsEvidence("24h", {
      now: () => fetchedAt,
      signal: controller.signal,
      fetchImpl: async (_url, init) => {
        if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        return new Response();
      },
    });
    assert.equal(response.status, "unavailable");
    if (response.status === "unavailable") assert.equal(response.code, "ABORTED");
  });

  await t.test("timeout", async () => {
    const response = await fetchUsgsEvidence("24h", {
      now: () => fetchedAt,
      timeoutMs: 5,
      fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    });
    assert.equal(response.status, "unavailable");
    if (response.status === "unavailable") assert.equal(response.code, "TIMEOUT");
  });
});
