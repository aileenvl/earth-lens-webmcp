import type { EvidenceRecord, Provider, SourceState } from "../types.ts";

export interface CoverageEntry { provider: Provider; state: "ready" | "empty" | "unavailable" | "stale" | "loading" | "idle" | "modelled"; detail: string }
export function analyzeCoverage(sourceStates: Record<Provider, SourceState>, evidence: readonly EvidenceRecord[], now = Date.now(), staleAfterMs = 60 * 60 * 1000): CoverageEntry[] {
  return (Object.keys(sourceStates) as Provider[]).map((provider) => {
    const source = sourceStates[provider];
    if (source.status === "ready" && provider === "open-meteo") return { provider, state: "modelled", detail: "Ready CAMS model output; not a local sensor observation." };
    if (source.status === "ready" && now - Date.parse(source.fetchedAt) > staleAfterMs) return { provider, state: "stale", detail: `Last successful refresh was ${source.fetchedAt}.` };
    if (source.status === "ready") return { provider, state: "ready", detail: `${evidence.filter((record) => record.provider === provider).length} evidence records in scope.` };
    if (source.status === "empty") return { provider, state: "empty", detail: source.reason };
    if (source.status === "unavailable") return { provider, state: "unavailable", detail: source.reason };
    if (source.status === "loading") return { provider, state: "loading", detail: `Refresh requested at ${source.requestedAt}.` };
    return { provider, state: "idle", detail: "Source has not been requested." };
  });
}
