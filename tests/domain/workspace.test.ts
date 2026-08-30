import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWorkspaceOperation,
  createWorkspaceState,
} from "../../app/domain/workspace.ts";
import {
  validateEvidenceRecord,
  validateInvestigationArea,
} from "../../app/domain/validation.ts";
import type { EvidenceRecord, WorkspaceOperation } from "../../app/domain/types.ts";

const earthquake: EvidenceRecord = {
  id: "usgs:tx-001",
  provider: "usgs",
  sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/tx-001",
  coordinates: { latitude: 25.6866, longitude: -100.3161 },
  observedAt: "2026-08-29T18:00:00.000Z",
  fetchedAt: "2026-08-29T18:03:00.000Z",
  evidenceType: "earthquake",
  title: "M 3.1 near Monterrey",
  attributes: { magnitude: 3.1, status: "reviewed" },
  limitation: "USGS event records may be updated after review.",
};

test("rejects invalid coordinates and radius at the boundary", () => {
  assert.equal(validateInvestigationArea({
    latitude: 91,
    longitude: -100,
    radiusKm: 20,
    label: "Invalid",
    updatedBy: "human",
  }).ok, false);
  assert.equal(validateInvestigationArea({
    latitude: 25,
    longitude: -181,
    radiusKm: 20,
    label: "Invalid",
    updatedBy: "human",
  }).ok, false);
  assert.equal(validateInvestigationArea({
    latitude: 25,
    longitude: -100,
    radiusKm: 0,
    label: "Invalid",
    updatedBy: "human",
  }).ok, false);
});

test("rejects evidence without complete provenance", () => {
  assert.equal(validateEvidenceRecord({ ...earthquake, sourceUrl: "javascript:alert(1)" }).ok, false);
  assert.equal(validateEvidenceRecord({ ...earthquake, limitation: "" }).ok, false);
  assert.equal(validateEvidenceRecord({ ...earthquake, fetchedAt: "yesterday" }).ok, false);
});

test("attributes human and agent operations in immutable revisions", () => {
  const initial = createWorkspaceState();
  const human = applyWorkspaceOperation(initial, {
    type: "set_area",
    actor: "human",
    at: "2026-08-29T18:06:00.000Z",
    area: { latitude: 25.6866, longitude: -100.3161, radiusKm: 50, label: "Monterrey", updatedBy: "human" },
  });
  assert.equal(human.ok, true);
  if (!human.ok) return;
  assert.notEqual(human.state, initial);
  assert.equal(human.state.revisions.at(-1)?.actor, "human");

  const agent = applyWorkspaceOperation(human.state, {
    type: "set_time_window",
    actor: "agent",
    at: "2026-08-29T18:07:00.000Z",
    timeWindow: "7d",
  });
  assert.equal(agent.ok, true);
  if (!agent.ok) return;
  assert.equal(agent.state.revisions.at(-1)?.actor, "agent");
  assert.deepEqual(initial.revisions, []);
});

test("every reversible mutation restores the exact prior state", () => {
  let state = createWorkspaceState();
  const operations: WorkspaceOperation[] = [
    { type: "set_area", actor: "human", at: "2026-08-29T18:06:00.000Z", area: { latitude: 25.6866, longitude: -100.3161, radiusKm: 50, label: "Monterrey", updatedBy: "human" } },
    { type: "set_time_window", actor: "agent", at: "2026-08-29T18:07:00.000Z", timeWindow: "24h" },
    { type: "set_visible_providers", actor: "human", at: "2026-08-29T18:08:00.000Z", providers: ["usgs", "eonet"] },
    { type: "replace_evidence", actor: "agent", at: "2026-08-29T18:09:00.000Z", evidence: [earthquake] },
    { type: "select_evidence", actor: "human", at: "2026-08-29T18:10:00.000Z", evidenceId: earthquake.id },
  ];

  for (const operation of operations) {
    const before = structuredClone(state);
    const result = applyWorkspaceOperation(state, operation);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    const undone = applyWorkspaceOperation(result.state, result.inverse);
    assert.equal(undone.ok, true);
    if (undone.ok) assert.deepEqual(undone.state, before);
    state = result.state;
  }
});

test("replacing evidence clears a selection that no longer exists", () => {
  const base = createWorkspaceState();
  const populated = applyWorkspaceOperation(base, {
    type: "replace_evidence",
    actor: "agent",
    at: "2026-08-29T18:09:00.000Z",
    evidence: [earthquake],
  });
  assert.equal(populated.ok, true);
  if (!populated.ok) return;
  const selected = applyWorkspaceOperation(populated.state, {
    type: "select_evidence",
    actor: "human",
    at: "2026-08-29T18:10:00.000Z",
    evidenceId: earthquake.id,
  });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  const result = applyWorkspaceOperation(selected.state, {
    type: "replace_evidence",
    actor: "agent",
    at: "2026-08-29T18:11:00.000Z",
    evidence: [],
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.state.selectedEvidenceId, null);
});

test("invalid state transitions return a structured error without partial mutation", () => {
  const state = createWorkspaceState();
  const result = applyWorkspaceOperation(state, {
    type: "select_evidence",
    actor: "agent",
    at: "2026-08-29T18:12:00.000Z",
    evidenceId: "usgs:missing",
  });
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "EVIDENCE_NOT_FOUND",
      message: "The requested evidence is not in the current workspace.",
      details: { evidenceId: "usgs:missing" },
    },
  });
  assert.equal(state.selectedEvidenceId, null);
});

test("source states must pass through loading before a terminal result", () => {
  const state = createWorkspaceState();
  const result = applyWorkspaceOperation(state, {
    type: "set_source_state",
    actor: "agent",
    at: "2026-08-29T18:12:00.000Z",
    provider: "usgs",
    sourceState: { status: "ready", fetchedAt: "2026-08-29T18:12:00.000Z", count: 2 },
  });
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "INVALID_SOURCE_TRANSITION",
      message: "Source usgs cannot transition from idle to ready.",
      details: { provider: "usgs", from: "idle", to: "ready" },
    },
  });
});

test("validates runtime attribution and draft provenance", () => {
  const state = createWorkspaceState();
  const invalidActor = applyWorkspaceOperation(state, {
    type: "set_time_window",
    actor: "system" as "agent",
    at: "2026-08-29T18:12:00.000Z",
    timeWindow: "7d",
  });
  assert.equal(invalidActor.ok, false);

  const invalidDraft = applyWorkspaceOperation(state, {
    type: "set_lens_draft",
    actor: "agent",
    at: "2026-08-29T18:12:00.000Z",
    lensDraft: {
      title: "",
      summary: "Evidence summary",
      createdAt: "2026-08-29T18:12:00.000Z",
      createdBy: "agent",
      status: "draft",
    },
  });
  assert.equal(invalidDraft.ok, false);
});
