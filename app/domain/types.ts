export type Actor = "human" | "agent";
export type Provider = "usgs" | "eonet" | "open-meteo" | "nasa-firms";
export type TimeWindow = "24h" | "7d" | "30d";
export type EvidenceId = `${Provider}:${string}`;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface InvestigationArea extends Coordinates {
  radiusKm: number;
  label: string;
  updatedBy: Actor;
}

export interface EvidenceRecord {
  id: EvidenceId;
  provider: Provider;
  sourceUrl: string;
  coordinates: Coordinates;
  observedAt: string;
  fetchedAt: string;
  evidenceType: "earthquake" | "natural-event" | "air-quality" | "thermal-hotspot";
  title: string;
  attributes: Readonly<Record<string, string | number | boolean | null>>;
  limitation: string;
}

export type SourceState =
  | { status: "idle" }
  | { status: "loading"; requestedAt: string }
  | { status: "ready"; fetchedAt: string; count: number }
  | { status: "empty"; fetchedAt: string; reason: string }
  | { status: "unavailable"; fetchedAt: string; reason: string };

export interface ActivityEntry {
  id: string;
  actor: Actor;
  at: string;
  summary: string;
}

export interface Revision {
  id: string;
  actor: Actor;
  at: string;
  operation: Exclude<WorkspaceOperation["type"], "restore_snapshot">;
}

export interface LensDraft {
  title: string;
  summary: string;
  createdAt: string;
  createdBy: Actor;
  status: "draft";
}

export interface WorkspaceState {
  area: InvestigationArea;
  timeWindow: TimeWindow;
  visibleProviders: Provider[];
  evidence: EvidenceRecord[];
  selectedEvidenceId: EvidenceId | null;
  sourceStates: Record<Provider, SourceState>;
  activity: ActivityEntry[];
  revisions: Revision[];
  lensDraft: LensDraft | null;
}

interface OperationMetadata {
  actor: Actor;
  at: string;
}

export type WorkspaceOperation =
  | (OperationMetadata & { type: "set_area"; area: InvestigationArea })
  | (OperationMetadata & { type: "set_time_window"; timeWindow: TimeWindow })
  | (OperationMetadata & { type: "set_visible_providers"; providers: Provider[] })
  | (OperationMetadata & { type: "replace_evidence"; evidence: EvidenceRecord[] })
  | (OperationMetadata & { type: "select_evidence"; evidenceId: EvidenceId | null })
  | (OperationMetadata & { type: "set_source_state"; provider: Provider; sourceState: SourceState })
  | (OperationMetadata & { type: "set_lens_draft"; lensDraft: LensDraft | null })
  | { type: "restore_snapshot"; snapshot: WorkspaceState };

export interface DomainError {
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DomainError };

export type OperationResult =
  | { ok: true; state: WorkspaceState; inverse: WorkspaceOperation }
  | { ok: false; error: DomainError };
