import type {
  EvidenceRecord,
  TimeWindow,
  ValidationResult,
} from "../domain/types.ts";
import type { SourceResult } from "./types.ts";
import { validateEvidenceRecord } from "../domain/validation.ts";

const feedUrls: Record<TimeWindow, string> = {
  "24h": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  "7d": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
  "30d": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson",
};

type JsonObject = Record<string, unknown>;

interface UsgsFetchOptions {
  fetchImpl?: typeof fetch;
  now?: () => string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const invalid = <T>(message: string, details?: Record<string, unknown>): ValidationResult<T> => ({
  ok: false,
  error: { code: "INVALID_RESPONSE", message, ...(details ? { details } : {}) },
});

export function getUsgsFeedUrl(window: TimeWindow): string {
  return feedUrls[window];
}

function normalizeFeature(value: unknown, fetchedAt: string, index: number): ValidationResult<EvidenceRecord> {
  if (!isObject(value) || typeof value.id !== "string" || !isObject(value.properties) || !isObject(value.geometry)) {
    return invalid("USGS returned a malformed earthquake feature.", { index });
  }
  const properties = value.properties;
  const geometry = value.geometry;
  const coordinates = geometry.coordinates;
  if (
    geometry.type !== "Point"
    || !Array.isArray(coordinates)
    || coordinates.length < 3
    || coordinates.some((coordinate) => typeof coordinate !== "number" || !Number.isFinite(coordinate))
    || typeof properties.mag !== "number"
    || !Number.isFinite(properties.mag)
    || typeof properties.place !== "string"
    || typeof properties.time !== "number"
    || typeof properties.updated !== "number"
    || !Number.isFinite(properties.time)
    || !Number.isFinite(properties.updated)
    || Number.isNaN(new Date(properties.time).getTime())
    || Number.isNaN(new Date(properties.updated).getTime())
    || typeof properties.url !== "string"
    || (properties.status !== "automatic" && properties.status !== "reviewed")
    || typeof properties.net !== "string"
    || typeof properties.code !== "string"
  ) {
    return invalid("USGS returned an earthquake with invalid geometry or provenance.", { index, id: value.id });
  }

  const [longitude, latitude, depthKm] = coordinates as number[];
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return invalid("USGS returned an earthquake outside valid WGS84 coordinates.", { index, id: value.id });
  }
  const observedAt = new Date(properties.time).toISOString();
  const updatedAt = new Date(properties.updated).toISOString();
  const reviewed = properties.status === "reviewed";

  return validateEvidenceRecord({
      id: `usgs:${value.id}`,
      provider: "usgs",
      sourceUrl: properties.url,
      coordinates: { latitude, longitude },
      observedAt,
      fetchedAt,
      evidenceType: "earthquake",
      title: `M ${properties.mag} · ${properties.place}`,
      attributes: {
        magnitude: properties.mag,
        depthKm,
        status: properties.status,
        updatedAt,
        network: properties.net,
        code: properties.code,
      },
      limitation: reviewed
        ? "Reviewed events have been checked by a human, but USGS records may still change as analysis continues."
        : "Automatic events have not yet been reviewed by a human; USGS records may change as analysis continues.",
  });
}

export function normalizeUsgsCollection(value: unknown, fetchedAt: string): ValidationResult<EvidenceRecord[]> {
  if (!isObject(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    return invalid("USGS did not return a GeoJSON FeatureCollection.");
  }
  const evidence: EvidenceRecord[] = [];
  for (const [index, feature] of value.features.entries()) {
    const normalized = normalizeFeature(feature, fetchedAt, index);
    if (!normalized.ok) return normalized;
    evidence.push(normalized.value);
  }
  return { ok: true, value: evidence };
}

export async function fetchUsgsEvidence(
  window: TimeWindow,
  options: UsgsFetchOptions = {},
): Promise<SourceResult<EvidenceRecord[]>> {
  const sourceUrl = getUsgsFeedUrl(window);
  const fetchedAt = (options.now ?? (() => new Date().toISOString()))();
  const timeoutController = new AbortController();
  const timeoutMs = options.timeoutMs ?? 10_000;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    timeoutController.abort("timeout");
  }, timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await (options.fetchImpl ?? fetch)(sourceUrl, {
      signal,
      headers: { accept: "application/geo+json, application/json" },
    });
    if (!response.ok) {
      return {
        status: "unavailable",
        code: "HTTP_ERROR",
        message: `USGS request failed with HTTP ${response.status}.`,
        details: { status: response.status },
        fetchedAt,
        sourceUrl,
      };
    }
    const normalized = normalizeUsgsCollection(await response.json(), fetchedAt);
    if (!normalized.ok) {
      return { status: "unavailable", ...normalized.error, fetchedAt, sourceUrl };
    }
    if (normalized.value.length === 0) {
      return {
        status: "empty",
        fetchedAt,
        sourceUrl,
        reason: "USGS reported no earthquakes for this time window.",
      };
    }
    return { status: "ready", data: normalized.value, fetchedAt, sourceUrl };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      status: "unavailable",
      code: timedOut ? "TIMEOUT" : aborted || options.signal?.aborted ? "ABORTED" : "NETWORK_ERROR",
      message: timedOut
        ? `USGS did not respond within ${timeoutMs}ms.`
        : aborted || options.signal?.aborted
          ? "USGS request was cancelled."
          : "USGS could not be reached.",
      fetchedAt,
      sourceUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
}
