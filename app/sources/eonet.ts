import type { EvidenceRecord, ValidationResult } from "../domain/types.ts";
import { validateEvidenceRecord } from "../domain/validation.ts";
import type { SourceResult } from "./types.ts";

type JsonObject = Record<string, unknown>;
export type EonetStatus = "open" | "closed" | "all";
export type EonetBbox = readonly [minLongitude: number, maxLatitude: number, maxLongitude: number, minLatitude: number];

export interface EonetQuery {
  status?: EonetStatus;
  days?: number;
  bbox?: EonetBbox;
  limit?: number;
}

interface EonetFetchOptions {
  fetchImpl?: typeof fetch;
  now?: () => string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const invalid = <T>(message: string, details?: Record<string, unknown>): ValidationResult<T> => ({
  ok: false,
  error: { code: "INVALID_RESPONSE", message, ...(details ? { details } : {}) },
});

export function getEonetEventsUrl(query: EonetQuery = {}): string {
  const url = new URL("https://eonet.gsfc.nasa.gov/api/v3/events");
  url.searchParams.set("status", query.status ?? "open");
  if (query.days !== undefined) url.searchParams.set("days", String(query.days));
  if (query.limit !== undefined) url.searchParams.set("limit", String(query.limit));
  if (query.bbox) url.searchParams.set("bbox", query.bbox.join(","));
  return url.toString();
}

function normalizeEvent(value: unknown, fetchedAt: string, index: number): ValidationResult<EvidenceRecord | null> {
  if (!isObject(value) || typeof value.id !== "string" || typeof value.title !== "string" || !Array.isArray(value.geometry)) {
    return invalid("NASA EONET returned a malformed natural event.", { index });
  }
  const categories = Array.isArray(value.categories) ? value.categories : [];
  const sources = Array.isArray(value.sources) ? value.sources : [];
  const points = value.geometry.filter((geometry): geometry is JsonObject => isObject(geometry) && geometry.type === "Point");
  if (points.length === 0) return { ok: true, value: null };
  const latest = points.toSorted((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!Array.isArray(latest.coordinates) || latest.coordinates.length < 2 || typeof latest.date !== "string") {
    return invalid("NASA EONET returned invalid point geometry.", { index, id: value.id });
  }
  const [longitude, latitude] = latest.coordinates;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return invalid("NASA EONET returned invalid point coordinates.", { index, id: value.id });
  }
  const observedAt = new Date(latest.date);
  if (Number.isNaN(observedAt.getTime())) return invalid("NASA EONET returned an invalid geometry date.", { index, id: value.id });
  const origin = sources.find((source) => isObject(source) && typeof source.url === "string" && source.url.startsWith("https://"));
  const category = categories.find((item) => isObject(item) && typeof item.title === "string");
  if (!origin || !isObject(origin)) return invalid("NASA EONET event is missing an originating source link.", { index, id: value.id });

  return validateEvidenceRecord({
    id: `eonet:${value.id}`,
    provider: "eonet",
    sourceUrl: String(origin.url),
    coordinates: { latitude, longitude },
    observedAt: observedAt.toISOString(),
    fetchedAt,
    evidenceType: "natural-event",
    title: value.title,
    attributes: {
      category: isObject(category) ? String(category.title) : "Natural event",
      eonetEventUrl: `https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(value.id)}`,
      sourceId: typeof origin.id === "string" ? origin.id : "originating source",
      status: value.closed === null ? "open" : "closed",
      magnitudeValue: typeof latest.magnitudeValue === "number" ? latest.magnitudeValue : null,
      magnitudeUnit: typeof latest.magnitudeUnit === "string" ? latest.magnitudeUnit : null,
    },
    limitation: "NASA EONET metadata is for visualization and general information only; spatial and temporal extents may be approximate and are not official alerts.",
  });
}

export function normalizeEonetEvents(value: unknown, fetchedAt: string): ValidationResult<EvidenceRecord[]> {
  if (!isObject(value) || !Array.isArray(value.events)) return invalid("NASA EONET did not return an events collection.");
  const records: EvidenceRecord[] = [];
  for (const [index, event] of value.events.entries()) {
    const normalized = normalizeEvent(event, fetchedAt, index);
    if (!normalized.ok) return normalized;
    if (normalized.value) records.push(normalized.value);
  }
  return { ok: true, value: records };
}

export async function fetchEonetEvidence(query: EonetQuery = {}, options: EonetFetchOptions = {}): Promise<SourceResult<EvidenceRecord[]>> {
  const sourceUrl = getEonetEventsUrl(query);
  const fetchedAt = (options.now ?? (() => new Date().toISOString()))();
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const timeout = setTimeout(() => { timedOut = true; timeoutController.abort("timeout"); }, timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutController.signal]) : timeoutController.signal;
  try {
    const response = await (options.fetchImpl ?? fetch)(sourceUrl, { signal, headers: { accept: "application/json" } });
    if (!response.ok) return { status: "unavailable", code: "HTTP_ERROR", message: `NASA EONET request failed with HTTP ${response.status}.`, fetchedAt, sourceUrl };
    const normalized = normalizeEonetEvents(await response.json(), fetchedAt);
    if (!normalized.ok) return { status: "unavailable", ...normalized.error, fetchedAt, sourceUrl };
    if (normalized.value.length === 0) return { status: "empty", fetchedAt, sourceUrl, reason: "NASA EONET reported no supported point events for this query." };
    return { status: "ready", data: normalized.value, fetchedAt, sourceUrl };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      status: "unavailable",
      code: timedOut ? "TIMEOUT" : aborted || options.signal?.aborted ? "ABORTED" : "NETWORK_ERROR",
      message: timedOut ? `NASA EONET did not respond within ${timeoutMs}ms.` : aborted || options.signal?.aborted ? "NASA EONET request was cancelled." : "NASA EONET could not be reached.",
      fetchedAt,
      sourceUrl,
    };
  } finally { clearTimeout(timeout); }
}
