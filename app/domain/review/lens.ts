import type { Actor, EvidenceRecord, InvestigationArea, TimeWindow } from "../types.ts";
import type { CoverageEntry } from "./coverage.ts";

export interface SituationLensDraft { title: string; summary: string; area: InvestigationArea; timeWindow: TimeWindow; gaps: CoverageEntry[]; citations: string[]; createdAt: string; createdBy: Actor; revision: number; status: "draft" }
interface DraftInput { title: string; area: InvestigationArea; timeWindow: TimeWindow; evidence: readonly EvidenceRecord[]; coverage: CoverageEntry[]; createdAt: string; revision: number }
export function createSituationLensDraft(input: DraftInput): SituationLensDraft {
  const citations = [...new Set(input.evidence.map((record) => record.sourceUrl))];
  const counts = input.evidence.reduce<Record<string, number>>((result, record) => ({ ...result, [record.provider]: (result[record.provider] ?? 0) + 1 }), {});
  return { title: input.title.trim() || "Environmental situation lens", summary: `Evidence in scope: ${Object.entries(counts).map(([provider, count]) => `${provider} ${count}`).join(", ") || "none"}.`, area: structuredClone(input.area), timeWindow: input.timeWindow, gaps: input.coverage.filter((entry) => entry.state !== "ready"), citations, createdAt: input.createdAt, createdBy: "agent", revision: input.revision, status: "draft" };
}
export function reviseSituationLensDraft(draft: SituationLensDraft, summary: string, at: string): SituationLensDraft {
  if (!summary.trim() || !Number.isFinite(Date.parse(at))) throw new Error("A revision needs non-empty content and a valid timestamp.");
  return { ...structuredClone(draft), summary: summary.trim(), createdAt: at, createdBy: "human", revision: draft.revision + 1, status: "draft" };
}
