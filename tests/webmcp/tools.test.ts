import assert from "node:assert/strict";
import test from "node:test";
import { createEarthLensTools } from "../../app/webmcp/tools.ts";
import { registerWebMcpTools } from "../../app/webmcp/register.ts";
import type { WebMcpActions } from "../../app/webmcp/types.ts";

const state = { activeLayers: ["earthquakes" as const], timeWindow: "24h" as const, selection: { latitude: 1, longitude: 2, radiusKm: 10, label: "Test", updatedBy: "human" as const }, evidence: [], areaEvidence: [], sourceStates: {}, revision: 4 };
const actions: WebMcpActions = { getState: () => state, listSources: () => [], setLayerVisibility: (layerId, visible) => ({ layerId, visible }), setTimeWindow: (window) => ({ window }), setArea: (area) => area, inspectEvidence: () => null, analyzeCoverage: () => ({ ready: [] }), createLensDraft: (title) => ({ title, status: "draft" }), undoLastAgentChange: () => ({ undone: false }), focusPlace: async (query, radiusKm) => ({ ok: true, data: { query, radiusKm } }) };
const decode = async (toolName: string, input: Record<string, unknown> = {}) => JSON.parse((await createEarthLensTools(actions).find((tool) => tool.name === toolName)!.execute(input)).content[0].text);

test("exposes the accepted ten-tool semantic contract with strict schemas", () => {
  const allTools = createEarthLensTools(actions);
  const tools = allTools.filter((tool) => tool.name !== "focus_place");
  assert.deepEqual(tools.map((tool) => tool.name), ["get_workspace_state", "list_authoritative_sources", "set_layer_visibility", "set_time_window", "set_geographic_area", "query_selected_area", "inspect_observation", "analyze_evidence_coverage", "create_situation_lens_draft", "undo_last_agent_change"]);
  assert.equal(allTools[10]?.name, "focus_place");
  assert.equal(tools.every((tool) => tool.description.length > 20 && tool.inputSchema.additionalProperties === false), true);
  assert.equal(allTools[10].description.length > 20 && allTools[10].inputSchema.additionalProperties === false, true);
});
test("uses one envelope and validates execution input again", async () => {
  assert.deepEqual(await decode("get_workspace_state"), { ok: true, data: state });
  const invalid = await decode("set_time_window", { window: "forever" }); assert.equal(invalid.ok, false); assert.equal(invalid.error.code, "INVALID_INPUT");
  assert.equal((await decode("set_geographic_area", { latitude: 999, longitude: 2, radiusKm: 10 })).ok, false);
  assert.deepEqual(await decode("focus_place", { query: "CDMX", radiusKm: 75 }), { ok: true, data: { query: "CDMX", radiusKm: 75 } });
});
test("feature detection degrades safely and registration cleanup aborts once", async () => {
  assert.equal(await registerWebMcpTools(undefined, []).ready, false);
  let aborted = false; const registration = registerWebMcpTools({ registerTool: async (_tool, options) => { options?.signal?.addEventListener("abort", () => { aborted = true; }); } }, createEarthLensTools(actions));
  assert.equal(await registration.ready, true); registration.cleanup(); assert.equal(aborted, true);
});
