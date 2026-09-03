import assert from "node:assert/strict";
import test from "node:test";

import { parseAssistantPlan, parseChatRequest } from "../../app/chat/contract.ts";

const workspace = {
  activeLayers: ["earthquakes", "air-quality", "natural-events", "thermal-hotspots"],
  timeWindow: "24h",
  selection: { latitude: 25.6866, longitude: -100.3161, radiusKm: 100, label: "Monterrey region" },
  sourceStates: { usgs: { status: "ready" }, eonet: { status: "empty" }, "open-meteo": { status: "ready" }, "nasa-firms": { status: "ready" } },
  evidence: [{ id: "usgs-1", title: "M 3.1 test", provider: "usgs", observedAt: "2026-08-30T12:00:00.000Z", limitation: "Preliminary.", facts: ["Magnitude 3.1"] }],
};

test("chat requests accept a bounded prompt and current workspace", () => {
  const result = parseChatRequest({ message: "What is happening here?", history: [], workspace });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.workspace.evidence.length, 1);
  if (result.ok) assert.deepEqual(result.value.workspace.evidence[0].facts, ["Magnitude 3.1"]);
});

test("chat requests reject empty, oversized, and structurally invalid input", () => {
  assert.equal(parseChatRequest({ message: "", history: [], workspace }).ok, false);
  assert.equal(parseChatRequest({ message: "x".repeat(1001), history: [], workspace }).ok, false);
  assert.equal(parseChatRequest({ message: "hello", history: [], workspace: { ...workspace, evidence: "nope" } }).ok, false);
});

test("assistant plans allow only validated Earth Lens actions", () => {
  const valid = parseAssistantPlan({
    answer: "I’ll show the last seven days.",
    actions: [{ name: "set_time_window", window: "7d", layerId: null, visible: null, latitude: null, longitude: null, radiusKm: null, label: null, observationId: null, title: null, query: null }],
  });
  assert.equal(valid.ok, true);

  const thermalLayer = parseAssistantPlan({
    answer: "I’ll show satellite thermal detections.",
    actions: [{ name: "set_layer_visibility", window: null, layerId: "thermal-hotspots", visible: true, latitude: null, longitude: null, radiusKm: null, label: null, observationId: null, title: null, query: null }],
  });
  assert.equal(thermalLayer.ok, true);

  const invalid = parseAssistantPlan({
    answer: "Running arbitrary code.",
    actions: [{ name: "run_javascript", window: null, layerId: null, visible: null, latitude: null, longitude: null, radiusKm: null, label: null, observationId: null, title: null, query: null }],
  });
  assert.equal(invalid.ok, false);
});
