import assert from "node:assert/strict";
import test from "node:test";

import { requestAssistantPlan } from "../../app/chat/server.ts";

test("chat server keeps the key in authorization, disables storage, and validates structured output", async () => {
  let captured: { url?: string; init?: RequestInit } = {};
  const fetcher: typeof fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({
      output: [{
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify({ answer: "No events are reported in this area.", actions: [] }) }],
      }],
    }), { status: 200 });
  };

  const result = await requestAssistantPlan({
    message: "What is happening?",
    history: [],
    workspace: { activeLayers: ["earthquakes"], timeWindow: "24h", selection: { latitude: 25, longitude: -100, radiusKm: 100, label: "Test" }, sourceStates: { usgs: { status: "empty" } }, evidence: [] },
  }, { apiKey: "secret-test-key", fetcher });

  assert.equal(result.answer, "No events are reported in this area.");
  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(new Headers(captured.init?.headers).get("authorization"), "Bearer secret-test-key");
  const body = JSON.parse(String(captured.init?.body));
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, "json_schema");
  assert.match(body.instructions, /Only propose actions the person explicitly requests/);
  assert.match(body.instructions, /create a draft only when the person asks/);
  assert.match(body.instructions, /event time window does not apply to current air-quality evidence/);
  assert.match(body.instructions, /current weather evidence/);
  assert.match(body.instructions, /always include inspect_observation for the most relevant matching record/);
  assert.match(body.instructions, /set_layer_visibility first when that evidence layer is hidden/);
  assert.match(body.instructions, /Use focus_place for a named location/);
  assert.match(body.instructions, /ALWAYS call focus_place immediately/);
  assert.match(body.instructions, /official SMN municipal forecast/i);
  assert.match(body.instructions, /not a station observation or safety verdict/i);
});

test("chat server does not expose upstream error details", async () => {
  const fetcher: typeof fetch = async () => new Response("sensitive upstream detail", { status: 500 });
  await assert.rejects(
    requestAssistantPlan({ message: "hello", history: [], workspace: { activeLayers: [], timeWindow: "24h", selection: { latitude: 0, longitude: 0, radiusKm: 10, label: "Test" }, sourceStates: {}, evidence: [] } }, { apiKey: "key", fetcher }),
    /Assistant service is temporarily unavailable/,
  );
});

test("a place move cannot inspect stale evidence from the previous area", async () => {
  const action = (name: "focus_place" | "inspect_observation", query: string | null, observationId: string | null) => ({ name, window: null, layerId: null, visible: null, latitude: null, longitude: null, radiusKm: null, label: null, observationId, title: null, query });
  const fetcher: typeof fetch = async () => Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ answer: "Moving the map.", actions: [action("focus_place", "CDMX", null), action("inspect_observation", null, "old-air")] }) }] }] });

  const result = await requestAssistantPlan({
    message: "What is the air quality in CDMX?",
    history: [],
    workspace: { activeLayers: ["air-quality"], timeWindow: "24h", selection: { latitude: 25.68, longitude: -100.31, radiusKm: 100, label: "Monterrey" }, sourceStates: {}, evidence: [] },
  }, { apiKey: "test-key", fetcher });

  assert.deepEqual(result.actions.map(({ name }) => name), ["focus_place"]);
});

test("an air-quality follow-up always opens the refreshed evidence", async () => {
  const fetcher: typeof fetch = async () => Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ answer: "AQI 87, Moderate.", actions: [] }) }] }] });
  const result = await requestAssistantPlan({
    message: "What are the air quality levels now?",
    history: [],
    workspace: { activeLayers: ["air-quality"], timeWindow: "24h", selection: { latitude: 19.43, longitude: -99.14, radiusKm: 100, label: "Mexico City" }, sourceStates: {}, evidence: [{ id: "cdmx-air", title: "US AQI 87", provider: "open-meteo", observedAt: "2026-09-01T19:00:00Z", limitation: "Modelled.", facts: ["US AQI 87 (Moderate)"] }] },
  }, { apiKey: "test-key", fetcher });

  assert.deepEqual(result.actions.map(({ name, observationId }) => ({ name, observationId })), [{ name: "inspect_observation", observationId: "cdmx-air" }]);
});

test("a thermal-hotspot follow-up opens the shared NASA FIRMS record", async () => {
  const fetcher: typeof fetch = async () => Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ answer: "One satellite heat detection is in the area.", actions: [] }) }] }] });
  const result = await requestAssistantPlan({
    message: "Are there any fires or thermal hotspots near me?",
    history: [],
    workspace: { activeLayers: ["thermal-hotspots"], timeWindow: "24h", selection: { latitude: 25.68, longitude: -100.31, radiusKm: 100, label: "Monterrey" }, sourceStates: {}, evidence: [{ id: "nasa-firms:1", title: "Nominal-confidence satellite thermal hotspot", provider: "nasa-firms", observedAt: "2026-09-03T08:11:00Z", limitation: "Not a confirmed wildfire.", facts: ["Confidence nominal", "FRP 0.96 MW"] }] },
  }, { apiKey: "test-key", fetcher });

  assert.deepEqual(result.actions.map(({ name, observationId }) => ({ name, observationId })), [{ name: "inspect_observation", observationId: "nasa-firms:1" }]);
});

test("a named city question cannot answer with or inspect the current city's evidence", async () => {
  const staleAction = { name: "inspect_observation", window: null, layerId: null, visible: null, latitude: null, longitude: null, radiusKm: null, label: null, observationId: "monterrey-air", title: null, query: null };
  const fetcher: typeof fetch = async () => Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ answer: "CDMX has AQI 55.", actions: [staleAction] }) }] }] });
  const result = await requestAssistantPlan({
    message: "What is the air quality in CDMX?",
    history: [],
    workspace: { activeLayers: ["air-quality"], timeWindow: "24h", selection: { latitude: 25.68, longitude: -100.31, radiusKm: 100, label: "Monterrey" }, sourceStates: {}, evidence: [{ id: "monterrey-air", title: "US AQI 55", provider: "open-meteo", observedAt: "2026-09-01T19:00:00Z", limitation: "Modelled.", facts: ["US AQI 55 (Moderate)"] }] },
  }, { apiKey: "test-key", fetcher });

  assert.equal(result.answer, "I’ll focus the map on CDMX and refresh the evidence for that area first.");
  assert.deepEqual(result.actions.map(({ name, query, observationId }) => ({ name, query, observationId })), [{ name: "focus_place", query: "CDMX", observationId: null }]);
});
