import type {
  Actor,
  OperationResult,
  Provider,
  Revision,
  WorkspaceOperation,
  WorkspaceState,
} from "./types.ts";
import { validateEvidenceRecord, validateInvestigationArea } from "./validation.ts";

const providers: Provider[] = ["usgs", "eonet", "open-meteo"];
const terminalSourceStates = ["ready", "empty", "unavailable"] as const;

export function createWorkspaceState(): WorkspaceState {
  return {
    area: {
      latitude: 25.6866,
      longitude: -100.3161,
      radiusKm: 100,
      label: "Monterrey, Mexico",
      updatedBy: "human",
    },
    timeWindow: "24h",
    visibleProviders: [...providers],
    evidence: [],
    selectedEvidenceId: null,
    sourceStates: {
      usgs: { status: "idle" },
      eonet: { status: "idle" },
      "open-meteo": { status: "idle" },
    },
    activity: [],
    revisions: [],
    lensDraft: null,
  };
}

const failed = (code: string, message: string, details?: Record<string, unknown>): OperationResult => ({
  ok: false,
  error: { code, message, ...(details ? { details } : {}) },
});

const revisionFor = (
  state: WorkspaceState,
  operation: Exclude<WorkspaceOperation, { type: "restore_snapshot" }>,
): Revision => ({
  id: `revision-${state.revisions.length + 1}`,
  actor: operation.actor,
  at: operation.at,
  operation: operation.type,
});

const withRevision = (
  state: WorkspaceState,
  operation: Exclude<WorkspaceOperation, { type: "restore_snapshot" }>,
): WorkspaceState => ({
  ...state,
  revisions: [...state.revisions, revisionFor(state, operation)],
});

export function applyWorkspaceOperation(state: WorkspaceState, operation: WorkspaceOperation): OperationResult {
  const before = structuredClone(state);
  if (operation.type === "restore_snapshot") {
    return {
      ok: true,
      state: structuredClone(operation.snapshot),
      inverse: { type: "restore_snapshot", snapshot: before },
    };
  }

  if (operation.actor !== "human" && operation.actor !== "agent") {
    return failed("INVALID_ACTOR", "Workspace operations must be attributed to a human or agent.");
  }
  if (!Number.isFinite(Date.parse(operation.at))) {
    return failed("INVALID_OPERATION_TIME", "Operation time must be a valid date.");
  }

  let next: WorkspaceState;
  switch (operation.type) {
    case "set_area": {
      const area = validateInvestigationArea(operation.area);
      if (!area.ok) return { ok: false, error: area.error };
      next = { ...state, area: { ...area.value, updatedBy: operation.actor } };
      break;
    }
    case "set_time_window":
      next = { ...state, timeWindow: operation.timeWindow };
      break;
    case "set_visible_providers": {
      if (operation.providers.some((provider) => !providers.includes(provider))) {
        return failed("INVALID_PROVIDER", "Visible providers contain an unsupported provider.");
      }
      next = { ...state, visibleProviders: [...new Set(operation.providers)] };
      break;
    }
    case "replace_evidence": {
      for (const record of operation.evidence) {
        const evidence = validateEvidenceRecord(record);
        if (!evidence.ok) return { ok: false, error: evidence.error };
      }
      const evidence = structuredClone(operation.evidence);
      const selectionExists = evidence.some((record) => record.id === state.selectedEvidenceId);
      next = { ...state, evidence, selectedEvidenceId: selectionExists ? state.selectedEvidenceId : null };
      break;
    }
    case "select_evidence":
      if (operation.evidenceId && !state.evidence.some((record) => record.id === operation.evidenceId)) {
        return failed(
          "EVIDENCE_NOT_FOUND",
          "The requested evidence is not in the current workspace.",
          { evidenceId: operation.evidenceId },
        );
      }
      next = { ...state, selectedEvidenceId: operation.evidenceId };
      break;
    case "set_source_state": {
      const currentStatus = state.sourceStates[operation.provider].status;
      const nextStatus = operation.sourceState.status;
      const validTransition =
        nextStatus === "loading"
        || (currentStatus === "loading" && terminalSourceStates.includes(nextStatus as typeof terminalSourceStates[number]));
      if (!validTransition) {
        return failed(
          "INVALID_SOURCE_TRANSITION",
          `Source ${operation.provider} cannot transition from ${currentStatus} to ${nextStatus}.`,
          { provider: operation.provider, from: currentStatus, to: nextStatus },
        );
      }
      if (
        (operation.sourceState.status === "loading" && !Number.isFinite(Date.parse(operation.sourceState.requestedAt)))
        || (operation.sourceState.status !== "loading"
          && operation.sourceState.status !== "idle"
          && !Number.isFinite(Date.parse(operation.sourceState.fetchedAt)))
        || (operation.sourceState.status === "ready"
          && (!Number.isInteger(operation.sourceState.count) || operation.sourceState.count < 0))
      ) {
        return failed("INVALID_SOURCE_STATE", "Source state metadata is invalid.");
      }
      next = {
        ...state,
        sourceStates: { ...state.sourceStates, [operation.provider]: structuredClone(operation.sourceState) },
      };
      break;
    }
    case "set_lens_draft":
      if (operation.lensDraft && (
        !operation.lensDraft.title.trim()
        || !operation.lensDraft.summary.trim()
        || operation.lensDraft.status !== "draft"
        || operation.lensDraft.createdBy !== operation.actor
        || !Number.isFinite(Date.parse(operation.lensDraft.createdAt))
      )) {
        return failed("INVALID_LENS_DRAFT", "Lens drafts require attributed, dated draft content.");
      }
      next = { ...state, lensDraft: structuredClone(operation.lensDraft) };
      break;
  }

  return {
    ok: true,
    state: withRevision(next, operation),
    inverse: { type: "restore_snapshot", snapshot: before },
  };
}

export function operationActor(operation: WorkspaceOperation): Actor | null {
  return operation.type === "restore_snapshot" ? null : operation.actor;
}
