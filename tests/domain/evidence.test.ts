import assert from "node:assert/strict";
import test from "node:test";

import { distanceKm, filterEvidenceForArea } from "../../app/domain/evidence.ts";
import type { EvidenceRecord, InvestigationArea } from "../../app/domain/types.ts";

const area: InvestigationArea = {
  latitude: 25.6866,
  longitude: -100.3161,
  radiusKm: 150,
  label: "Monterrey",
  updatedBy: "human",
};

const evidence = (id: `usgs:${string}`, latitude: number, longitude: number, observedAt: string): EvidenceRecord => ({
  id,
  provider: "usgs",
  sourceUrl: `https://earthquake.usgs.gov/earthquakes/eventpage/${id.slice(5)}`,
  coordinates: { latitude, longitude },
  observedAt,
  fetchedAt: "2026-08-30T12:00:00.000Z",
  evidenceType: "earthquake",
  title: id,
  attributes: { magnitude: 2.5, status: "reviewed" },
  limitation: "USGS records may change.",
});

test("computes stable geodesic distance in kilometres", () => {
  assert.equal(Math.round(distanceKm(area, { latitude: 25.6866, longitude: -100.3161 })), 0);
  assert.equal(Math.round(distanceKm(area, { latitude: 25.4383, longitude: -100.9737 })), 72);
});

test("filters by radius and sorts newest evidence first without mutating input", () => {
  const records = [
    evidence("usgs:old-near", 25.7, -100.3, "2026-08-29T10:00:00.000Z"),
    evidence("usgs:far", 19.4, -99.1, "2026-08-30T11:00:00.000Z"),
    evidence("usgs:new-near", 25.8, -100.4, "2026-08-30T10:00:00.000Z"),
  ];
  const snapshot = structuredClone(records);

  assert.deepEqual(filterEvidenceForArea(records, area).map((record) => record.id), [
    "usgs:new-near",
    "usgs:old-near",
  ]);
  assert.deepEqual(records, snapshot);
});
