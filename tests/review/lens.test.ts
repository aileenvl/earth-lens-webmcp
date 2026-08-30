import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCoverage } from "../../app/domain/review/coverage.ts";
import { createSituationLensDraft, reviseSituationLensDraft } from "../../app/domain/review/lens.ts";
import type { EvidenceRecord } from "../../app/domain/types.ts";

const evidence: EvidenceRecord = { id: "usgs:test", provider: "usgs", sourceUrl: "https://earthquake.usgs.gov/test", coordinates: { latitude: 1, longitude: 2 }, observedAt: "2026-08-30T10:00:00Z", fetchedAt: "2026-08-30T11:00:00Z", evidenceType: "earthquake", title: "Test", attributes: {}, limitation: "May change." };
test("coverage distinguishes ready, unavailable, and modelled sources", () => {
  const coverage = analyzeCoverage({ usgs: { status: "ready", fetchedAt: "2026-08-30T11:00:00Z", count: 1 }, eonet: { status: "unavailable", fetchedAt: "2026-08-30T11:00:00Z", reason: "offline" }, "open-meteo": { status: "ready", fetchedAt: "2026-08-30T11:00:00Z", count: 1 } }, [evidence], Date.parse("2026-08-30T11:10:00Z"));
  assert.deepEqual(coverage.map((entry) => entry.state), ["ready", "unavailable", "modelled"]);
});
test("draft retains citations and gaps and human edits create a new draft revision", () => {
  const coverage = [{ provider: "eonet" as const, state: "empty" as const, detail: "none" }];
  const draft = createSituationLensDraft({ title: "Lens", area: { latitude: 1, longitude: 2, radiusKm: 5, label: "Area", updatedBy: "human" }, timeWindow: "24h", evidence: [evidence, evidence], coverage, createdAt: "2026-08-30T12:00:00Z", revision: 2 });
  assert.deepEqual(draft.citations, [evidence.sourceUrl]); assert.equal(draft.status, "draft"); assert.equal(draft.gaps.length, 1);
  const revised = reviseSituationLensDraft(draft, "Human correction", "2026-08-30T12:05:00Z");
  assert.equal(revised.createdBy, "human"); assert.equal(revised.revision, 3); assert.equal(revised.status, "draft"); assert.deepEqual(revised.citations, draft.citations);
});
