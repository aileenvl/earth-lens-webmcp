import type { InvestigationArea, TimeWindow } from "../domain/types.ts";
import { validateInvestigationArea } from "../domain/validation.ts";
import type { LayerId, ModelContextTool, ToolEnvelope, WebMcpActions } from "./types.ts";

const layers: LayerId[] = ["earthquakes", "air-quality", "natural-events", "thermal-hotspots", "weather-forecast"];
const windows: TimeWindow[] = ["24h", "7d", "30d"];
const response = (envelope: ToolEnvelope) => ({ content: [{ type: "text" as const, text: JSON.stringify(envelope, null, 2) }] });
const success = (data: unknown) => response({ ok: true, data });
const failure = (code: string, message: string, details?: unknown) => response({ ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } });

export function createEarthLensTools(actions: WebMcpActions): ModelContextTool[] {
  return [
    { name: "get_workspace_state", description: "Inspect the current shared Earth Lens area, time window, visible layers, source states, evidence, and revision.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, execute: async () => success(actions.getState()) },
    { name: "list_authoritative_sources", description: "List Earth Lens environmental sources, attribution, evidence type, freshness state, and limitations.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, execute: async () => success(actions.listSources()) },
    {
      name: "set_layer_visibility", description: "Show or hide one environmental evidence layer on the shared map.",
      inputSchema: { type: "object", properties: { layerId: { type: "string", enum: layers }, visible: { type: "boolean" } }, required: ["layerId", "visible"], additionalProperties: false },
      execute: async ({ layerId, visible }) => typeof layerId !== "string" || !layers.includes(layerId as LayerId) || typeof visible !== "boolean" ? failure("INVALID_INPUT", "layerId and visible must match the advertised schema.") : success(actions.setLayerVisibility(layerId as LayerId, visible)),
    },
    {
      name: "set_time_window", description: "Change the shared evidence time window and visibly refresh time-dependent sources.",
      inputSchema: { type: "object", properties: { window: { type: "string", enum: windows } }, required: ["window"], additionalProperties: false },
      execute: async ({ window }) => typeof window !== "string" || !windows.includes(window as TimeWindow) ? failure("INVALID_INPUT", "window must be 24h, 7d, or 30d.") : success(actions.setTimeWindow(window as TimeWindow)),
    },
    {
      name: "set_geographic_area", description: "Set the shared WGS84 investigation center and radius in kilometres.",
      inputSchema: { type: "object", properties: { latitude: { type: "number", minimum: -90, maximum: 90 }, longitude: { type: "number", minimum: -180, maximum: 180 }, radiusKm: { type: "number", exclusiveMinimum: 0, maximum: 2000 }, label: { type: "string" } }, required: ["latitude", "longitude", "radiusKm"], additionalProperties: false },
      execute: async ({ latitude, longitude, radiusKm, label }) => {
        const candidate = { latitude, longitude, radiusKm, label: typeof label === "string" ? label : "Agent-selected region", updatedBy: "agent" } as InvestigationArea;
        const validated = validateInvestigationArea(candidate);
        return validated.ok ? success(actions.setArea(validated.value)) : failure(validated.error.code, validated.error.message, validated.error.details);
      },
    },
    { name: "query_selected_area", description: "Return evidence intersecting the current human-selected area with source states and caution context.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, execute: async () => { const state = actions.getState(); return success({ selection: state.selection, revision: state.revision, sourceStates: state.sourceStates, evidence: state.areaEvidence, caution: "Evidence may change and is not an official emergency alert." }); } },
    {
      name: "inspect_observation", description: "Inspect an evidence record by opaque ID and visibly select it in Earth Lens.",
      inputSchema: { type: "object", properties: { observationId: { type: "string", minLength: 1 } }, required: ["observationId"], additionalProperties: false },
      execute: async ({ observationId }) => { if (typeof observationId !== "string" || !observationId) return failure("INVALID_INPUT", "observationId must be a non-empty string."); const evidence = actions.inspectEvidence(observationId); return evidence ? success(evidence) : failure("EVIDENCE_NOT_FOUND", "The requested evidence is not in the current workspace.", { observationId }); },
    },
    { name: "analyze_evidence_coverage", description: "Explain ready, empty, unavailable, stale, and modelled source coverage without inventing a risk score.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, execute: async () => success(actions.analyzeCoverage()) },
    { name: "create_situation_lens_draft", description: "Create a provenance-rich situation lens draft for human review; this never publishes or sends anything.", inputSchema: { type: "object", properties: { title: { type: "string" } }, additionalProperties: false }, execute: async ({ title }) => success(actions.createLensDraft(typeof title === "string" && title.trim() ? title.trim() : "Environmental situation lens")) },
    { name: "undo_last_agent_change", description: "Undo the most recent reversible agent change only when no newer human correction would be overwritten.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, execute: async () => success(actions.undoLastAgentChange()) },
    {
      name: "focus_place", description: "Resolve a worldwide place name with ArcGIS, visibly move the shared investigation area, and refresh environmental evidence.",
      inputSchema: { type: "object", properties: { query: { type: "string", minLength: 2, maxLength: 160 }, radiusKm: { type: "number", exclusiveMinimum: 0, maximum: 2000 } }, required: ["query"], additionalProperties: false },
      execute: async ({ query, radiusKm }) => {
        if (typeof query !== "string" || query.trim().length < 2 || query.length > 160 || (radiusKm !== undefined && (typeof radiusKm !== "number" || !Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 2000))) return failure("INVALID_INPUT", "query must contain 2 to 160 characters and radiusKm must be between 0 and 2000.");
        const result = await actions.focusPlace(query.trim(), typeof radiusKm === "number" ? radiusKm : 100);
        return result.ok ? success(result.data) : failure(result.code, result.message, result.details);
      },
    },
  ];
}
