import type { LayerId } from "../webmcp/types.ts";
import type { TimeWindow } from "../domain/types.ts";

export type ChatHistoryItem = { role: "user" | "assistant"; content: string };
export type ChatWorkspace = {
  activeLayers: LayerId[];
  timeWindow: TimeWindow;
  selection: { latitude: number; longitude: number; radiusKm: number; label: string };
  sourceStates: Record<string, { status: string }>;
  evidence: Array<{ id: string; title: string; provider: string; observedAt: string; limitation: string; facts: string[] }>;
};
export type ChatRequest = { message: string; history: ChatHistoryItem[]; workspace: ChatWorkspace };

const actionNames = ["get_workspace_state", "list_authoritative_sources", "set_layer_visibility", "set_time_window", "set_geographic_area", "query_selected_area", "inspect_observation", "analyze_evidence_coverage", "create_situation_lens_draft", "undo_last_agent_change", "focus_place"] as const;
const officialEvidenceProviders = ["usgs", "eonet", "open-meteo", "nasa-firms", "smn"] as const;
const maxEvidenceCandidates = 1000;
const maxChatEvidence = 50;
export type ChatActionName = (typeof actionNames)[number];
export type AssistantAction = {
  name: ChatActionName;
  window: TimeWindow | null;
  layerId: LayerId | null;
  visible: boolean | null;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
  label: string | null;
  observationId: string | null;
  title: string | null;
  query: string | null;
};
export type AssistantPlan = { answer: string; actions: AssistantAction[] };
type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isLayer = (value: unknown): value is LayerId => value === "earthquakes" || value === "air-quality" || value === "natural-events" || value === "thermal-hotspots" || value === "weather-forecast";
const isWindow = (value: unknown): value is TimeWindow => value === "24h" || value === "7d" || value === "30d";
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function parseChatRequest(input: unknown): ParseResult<ChatRequest> {
  if (!isRecord(input) || typeof input.message !== "string") return { ok: false, error: "Invalid chat request." };
  const message = input.message.trim();
  if (!message || message.length > 1000 || !Array.isArray(input.history) || !isRecord(input.workspace)) return { ok: false, error: "Message and workspace are required." };
  const workspace = input.workspace;
  if (!Array.isArray(workspace.activeLayers) || !workspace.activeLayers.every(isLayer) || !isWindow(workspace.timeWindow) || !isRecord(workspace.selection) || !Array.isArray(workspace.evidence) || !isRecord(workspace.sourceStates)) return { ok: false, error: "Invalid workspace." };
  const selection = workspace.selection;
  if (!finite(selection.latitude) || !finite(selection.longitude) || !finite(selection.radiusKm) || typeof selection.label !== "string") return { ok: false, error: "Invalid selection." };
  const history: ChatHistoryItem[] = [];
  for (const item of input.history.slice(-8)) {
    if (!isRecord(item) || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string" || item.content.length > 1000) return { ok: false, error: "Invalid chat history." };
    history.push({ role: item.role, content: item.content });
  }
  const evidenceCandidates: ChatWorkspace["evidence"] = [];
  for (const item of workspace.evidence.slice(0, maxEvidenceCandidates)) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.provider !== "string" || typeof item.observedAt !== "string" || typeof item.limitation !== "string" || !Array.isArray(item.facts) || item.facts.length > 8 || !item.facts.every((fact) => typeof fact === "string" && fact.length <= 160)) return { ok: false, error: "Invalid evidence." };
    evidenceCandidates.push({ id: item.id, title: item.title, provider: item.provider, observedAt: item.observedAt, limitation: item.limitation, facts: [...item.facts] });
  }
  const evidence: ChatWorkspace["evidence"] = [];
  const reservedEvidence = new Set<ChatWorkspace["evidence"][number]>();
  for (const provider of officialEvidenceProviders) {
    const representative = evidenceCandidates.find((item) => item.provider === provider);
    if (representative) {
      evidence.push(representative);
      reservedEvidence.add(representative);
    }
  }
  for (const item of evidenceCandidates) {
    if (evidence.length >= maxChatEvidence) break;
    if (!reservedEvidence.has(item)) evidence.push(item);
  }
  const sourceStates: ChatWorkspace["sourceStates"] = {};
  for (const [key, value] of Object.entries(workspace.sourceStates)) {
    if (!isRecord(value) || typeof value.status !== "string") return { ok: false, error: "Invalid source state." };
    sourceStates[key] = { status: value.status };
  }
  return { ok: true, value: { message, history, workspace: { activeLayers: [...new Set(workspace.activeLayers)], timeWindow: workspace.timeWindow, selection: { latitude: selection.latitude, longitude: selection.longitude, radiusKm: selection.radiusKm, label: selection.label.slice(0, 120) }, sourceStates, evidence } } };
}

export function parseAssistantPlan(input: unknown): ParseResult<AssistantPlan> {
  if (!isRecord(input) || typeof input.answer !== "string" || !input.answer.trim() || input.answer.length > 2000 || !Array.isArray(input.actions) || input.actions.length > 4) return { ok: false, error: "Invalid assistant plan." };
  const actions: AssistantAction[] = [];
  for (const value of input.actions) {
    if (!isRecord(value) || typeof value.name !== "string" || !actionNames.includes(value.name as ChatActionName)) return { ok: false, error: "Unsupported assistant action." };
    const action = value as Record<string, unknown>;
    if (action.window !== null && !isWindow(action.window)) return { ok: false, error: "Invalid time window action." };
    if (action.layerId !== null && !isLayer(action.layerId)) return { ok: false, error: "Invalid layer action." };
    if (action.visible !== null && typeof action.visible !== "boolean") return { ok: false, error: "Invalid visibility action." };
    for (const field of ["latitude", "longitude", "radiusKm"] as const) if (action[field] !== null && !finite(action[field])) return { ok: false, error: "Invalid geographic action." };
    for (const field of ["label", "observationId", "title"] as const) if (action[field] !== null && typeof action[field] !== "string") return { ok: false, error: "Invalid action text." };
    if (action.query !== null && (typeof action.query !== "string" || action.query.trim().length < 2 || action.query.length > 160)) return { ok: false, error: "Invalid place query." };
    actions.push(action as AssistantAction);
  }
  return { ok: true, value: { answer: input.answer.trim(), actions } };
}

export const assistantPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "actions"],
  properties: {
    answer: { type: "string" },
    actions: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["name", "window", "layerId", "visible", "latitude", "longitude", "radiusKm", "label", "observationId", "title", "query"], properties: {
      name: { type: "string", enum: actionNames }, window: { type: ["string", "null"], enum: ["24h", "7d", "30d", null] }, layerId: { type: ["string", "null"], enum: ["earthquakes", "air-quality", "natural-events", "thermal-hotspots", "weather-forecast", null] }, visible: { type: ["boolean", "null"] }, latitude: { type: ["number", "null"] }, longitude: { type: ["number", "null"] }, radiusKm: { type: ["number", "null"] }, label: { type: ["string", "null"] }, observationId: { type: ["string", "null"] }, title: { type: ["string", "null"] }, query: { type: ["string", "null"] },
    } } },
  },
} as const;
