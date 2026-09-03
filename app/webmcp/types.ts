import type { EvidenceRecord, InvestigationArea, SourceState, TimeWindow } from "../domain/types.ts";

export type LayerId = "earthquakes" | "air-quality" | "natural-events" | "thermal-hotspots";
export interface WebMcpState {
  activeLayers: LayerId[];
  timeWindow: TimeWindow;
  selection: InvestigationArea;
  evidence: EvidenceRecord[];
  areaEvidence: EvidenceRecord[];
  sourceStates: Record<string, SourceState>;
  revision: number;
}
export interface ToolEnvelope { ok: boolean; data?: unknown; error?: { code: string; message: string; details?: unknown } }
export interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<{ content: Array<{ type: "text"; text: string }> }>;
}
export interface WebMcpActions {
  getState: () => WebMcpState;
  listSources: () => unknown;
  setLayerVisibility: (layerId: LayerId, visible: boolean) => unknown;
  setTimeWindow: (window: TimeWindow) => unknown;
  setArea: (area: InvestigationArea) => unknown;
  inspectEvidence: (id: string) => EvidenceRecord | null;
  analyzeCoverage: () => unknown;
  createLensDraft: (title: string) => unknown;
  undoLastAgentChange: () => unknown;
  focusPlace: (query: string, radiusKm: number) => Promise<{ ok: true; data: unknown } | { ok: false; code: string; message: string; details?: unknown }>;
}
