import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchNasaFirmsEvidence,
  getNasaFirmsUrl,
  normalizeNasaFirmsFeatures,
} from "../../app/sources/nasa-firms.ts";

const area = {
  latitude: 25.6866,
  longitude: -100.3161,
  radiusKm: 100,
  label: "Monterrey",
  updatedBy: "human" as const,
};

const feature = {
  attributes: {
    OBJECTID: 1592371,
    latitude: 25.69739,
    longitude: -100.30023,
    bright_ti4: 303.19,
    scan: 0.5,
    track: 0.41,
    acq_time: 1788423060000,
    satellite: "N20",
    confidence: "nominal",
    version: "2.0NRT",
    bright_ti5: 282.37,
    frp: 0.96,
    daynight: "N",
    hours_old: 10,
  },
  geometry: { x: -100.30023, y: 25.69739 },
};

test("builds a bounded, cacheable ArcGIS point-distance query", () => {
  const url = new URL(getNasaFirmsUrl(area, "24h"));
  assert.match(url.pathname, /FeatureServer\/0\/query$/);
  assert.equal(url.searchParams.get("where"), "hours_old <= 24");
  assert.equal(url.searchParams.get("geometry"), "-100.3161,25.6866");
  assert.equal(url.searchParams.get("geometryType"), "esriGeometryPoint");
  assert.equal(url.searchParams.get("distance"), "100");
  assert.equal(url.searchParams.get("units"), "esriSRUnit_Kilometer");
  assert.equal(url.searchParams.get("inSR"), "4326");
  assert.equal(url.searchParams.get("outSR"), "4326");
  assert.equal(url.searchParams.get("resultRecordCount"), "200");
  assert.equal(url.searchParams.get("orderByFields"), "acq_time DESC");
  assert.doesNotMatch(url.searchParams.get("outFields") ?? "", /\*/);
  assert.equal(new URL(getNasaFirmsUrl(area, "30d")).searchParams.get("where"), "hours_old <= 168");
});

test("normalizes a VIIRS detection with record provenance and scientific context", () => {
  const result = normalizeNasaFirmsFeatures(
    { spatialReference: { wkid: 4326 }, features: [feature] },
    "2026-09-03T12:00:00.000Z",
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const record = result.value[0];
  assert.equal(record.id, "nasa-firms:1592371");
  assert.equal(record.provider, "nasa-firms");
  assert.equal(record.evidenceType, "thermal-hotspot");
  assert.deepEqual(record.coordinates, { latitude: 25.69739, longitude: -100.30023 });
  assert.equal(record.observedAt, "2026-09-03T08:11:00.000Z");
  assert.deepEqual(record.attributes, {
    confidence: "nominal",
    satellite: "NOAA-20",
    frpMw: 0.96,
    dayNight: "night",
    pixelScanKm: 0.5,
    pixelTrackKm: 0.41,
    brightnessI4K: 303.19,
    brightnessI5K: 282.37,
    version: "2.0NRT",
    hoursOld: 10,
  });
  assert.match(record.sourceUrl, /OBJECTID%3D1592371/);
  assert.match(record.limitation, /not a confirmed wildfire/i);
  assert.match(record.limitation, /false positive/i);
});

test("rejects malformed enums, geometry disagreement, and invalid timestamps", () => {
  const fetchedAt = "2026-09-03T12:00:00.000Z";
  const badConfidence = { ...feature, attributes: { ...feature.attributes, confidence: "certain" } };
  assert.equal(normalizeNasaFirmsFeatures({ features: [badConfidence] }, fetchedAt).ok, false);
  const badGeometry = { ...feature, geometry: { x: -99, y: 25.69739 } };
  assert.equal(normalizeNasaFirmsFeatures({ features: [badGeometry] }, fetchedAt).ok, false);
  const badTime = { ...feature, attributes: { ...feature.attributes, acq_time: Number.NaN } };
  assert.equal(normalizeNasaFirmsFeatures({ features: [badTime] }, fetchedAt).ok, false);
});

test("caps records and returns independent empty, HTTP, and aborted states", async () => {
  const many = Array.from({ length: 205 }, (_, index) => ({
    ...feature,
    attributes: { ...feature.attributes, OBJECTID: index + 1 },
  }));
  const capped = normalizeNasaFirmsFeatures({ features: many }, "2026-09-03T12:00:00.000Z");
  assert.equal(capped.ok && capped.value.length, 200);

  const empty = await fetchNasaFirmsEvidence(area, "24h", {
    fetchImpl: async () => new Response(JSON.stringify({ features: [] })),
  });
  assert.equal(empty.status, "empty");

  const http = await fetchNasaFirmsEvidence(area, "24h", {
    fetchImpl: async () => new Response("nope", { status: 503 }),
  });
  assert.equal(http.status, "unavailable");
  if (http.status === "unavailable") assert.equal(http.code, "HTTP_ERROR");

  const controller = new AbortController();
  controller.abort();
  const aborted = await fetchNasaFirmsEvidence(area, "24h", {
    signal: controller.signal,
    fetchImpl: async (_url, init) => {
      throw new DOMException(String(init?.signal?.aborted), "AbortError");
    },
  });
  assert.equal(aborted.status, "unavailable");
  if (aborted.status === "unavailable") assert.equal(aborted.code, "ABORTED");
});
