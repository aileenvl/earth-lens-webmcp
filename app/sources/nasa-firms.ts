import type {
  EvidenceRecord,
  InvestigationArea,
  TimeWindow,
  ValidationResult,
} from "../domain/types.ts";
import { validateEvidenceRecord } from "../domain/validation.ts";
import type { SourceResult } from "./types.ts";

const layerUrl = "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/Satellite_VIIRS_Thermal_Hotspots_and_Fire_Activity/FeatureServer/0";
const resultLimit = 200;
const outFields = [
  "OBJECTID",
  "latitude",
  "longitude",
  "bright_ti4",
  "scan",
  "track",
  "acq_time",
  "satellite",
  "confidence",
  "version",
  "bright_ti5",
  "frp",
  "daynight",
  "hours_old",
] as const;

type JsonObject = Record<string, unknown>;
type Options = {
  fetchImpl?: typeof fetch;
  now?: () => string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const invalid = <T>(message: string, details?: Record<string, unknown>): ValidationResult<T> => ({
  ok: false,
  error: { code: "INVALID_RESPONSE", message, ...(details ? { details } : {}) },
});

const satelliteNames: Record<string, string> = {
  N: "Suomi NPP",
  N20: "NOAA-20",
  N21: "NOAA-21",
};

export function getNasaFirmsUrl(area: InvestigationArea, window: TimeWindow): string {
  const url = new URL(`${layerUrl}/query`);
  url.searchParams.set("where", `hours_old <= ${window === "24h" ? 24 : 168}`);
  url.searchParams.set("geometry", `${area.longitude},${area.latitude}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("distance", String(area.radiusKm));
  url.searchParams.set("units", "esriSRUnit_Kilometer");
  url.searchParams.set("outFields", outFields.join(","));
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("orderByFields", "acq_time DESC");
  url.searchParams.set("resultRecordCount", String(resultLimit));
  url.searchParams.set("f", "json");
  return url.toString();
}

function recordSourceUrl(objectId: number): string {
  const url = new URL(`${layerUrl}/query`);
  url.searchParams.set("where", `OBJECTID=${objectId}`);
  url.searchParams.set("outFields", outFields.join(","));
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "html");
  return url.toString();
}

function normalizeFeature(value: unknown, fetchedAt: string, index: number): ValidationResult<EvidenceRecord> {
  if (!isObject(value) || !isObject(value.attributes) || !isObject(value.geometry)) {
    return invalid("NASA FIRMS returned a malformed VIIRS feature.", { index });
  }
  const attributes = value.attributes;
  const geometry = value.geometry;
  const objectId = attributes.OBJECTID;
  const latitude = attributes.latitude;
  const longitude = attributes.longitude;
  const acquiredAt = attributes.acq_time;
  const confidence = attributes.confidence;
  const satellite = attributes.satellite;
  const dayNight = attributes.daynight;
  const version = attributes.version;
  const brightnessI4K = attributes.bright_ti4;
  const brightnessI5K = attributes.bright_ti5;
  const pixelScanKm = attributes.scan;
  const pixelTrackKm = attributes.track;
  const frpMw = attributes.frp;
  const hoursOld = attributes.hours_old;

  if (
    !finite(objectId)
    || !Number.isInteger(objectId)
    || !finite(latitude)
    || !finite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
    || !finite(geometry.x)
    || !finite(geometry.y)
    || Math.abs(geometry.x - longitude) > 0.001
    || Math.abs(geometry.y - latitude) > 0.001
    || !finite(acquiredAt)
    || Number.isNaN(new Date(acquiredAt).getTime())
    || (confidence !== "low" && confidence !== "nominal" && confidence !== "high")
    || typeof satellite !== "string"
    || !satelliteNames[satellite]
    || (dayNight !== "D" && dayNight !== "N")
    || typeof version !== "string"
    || !/^[A-Za-z0-9.-]{1,20}$/.test(version)
    || !finite(brightnessI4K)
    || !finite(brightnessI5K)
    || !finite(pixelScanKm)
    || !finite(pixelTrackKm)
    || !finite(frpMw)
    || !finite(hoursOld)
    || pixelScanKm <= 0
    || pixelTrackKm <= 0
    || hoursOld < 0
  ) {
    return invalid("NASA FIRMS returned invalid VIIRS geometry, time, or detection attributes.", { index });
  }

  const confidenceLabel = confidence[0].toUpperCase() + confidence.slice(1);
  return validateEvidenceRecord({
    id: `nasa-firms:${objectId}`,
    provider: "nasa-firms",
    sourceUrl: recordSourceUrl(objectId),
    coordinates: { latitude, longitude },
    observedAt: new Date(acquiredAt).toISOString(),
    fetchedAt,
    evidenceType: "thermal-hotspot",
    title: `${confidenceLabel}-confidence satellite thermal hotspot`,
    attributes: {
      confidence,
      satellite: satelliteNames[satellite],
      frpMw,
      dayNight: dayNight === "D" ? "day" : "night",
      pixelScanKm,
      pixelTrackKm,
      brightnessI4K,
      brightnessI5K,
      version,
      hoursOld,
    },
    limitation: "A VIIRS thermal hotspot is a roughly 375 m satellite pixel with a detected heat anomaly, not a confirmed wildfire, fire perimeter, cause, or local safety verdict. Industrial heat, oil or gas activity, volcanoes, and algorithm error can produce a false positive; near-real-time data may be delayed or incomplete.",
  });
}

export function normalizeNasaFirmsFeatures(value: unknown, fetchedAt: string): ValidationResult<EvidenceRecord[]> {
  if (!isObject(value) || !Array.isArray(value.features)) {
    return invalid("NASA FIRMS did not return an ArcGIS feature collection.");
  }
  if (value.spatialReference !== undefined && (!isObject(value.spatialReference) || value.spatialReference.wkid !== 4326)) {
    return invalid("NASA FIRMS did not return WGS84 geometry.");
  }
  const evidence: EvidenceRecord[] = [];
  for (const [index, feature] of value.features.slice(0, resultLimit).entries()) {
    const normalized = normalizeFeature(feature, fetchedAt, index);
    if (!normalized.ok) return normalized;
    evidence.push(normalized.value);
  }
  return { ok: true, value: evidence };
}

export async function fetchNasaFirmsEvidence(
  area: InvestigationArea,
  window: TimeWindow,
  options: Options = {},
): Promise<SourceResult<EvidenceRecord[]>> {
  const sourceUrl = getNasaFirmsUrl(area, window);
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
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return {
        status: "unavailable",
        code: "HTTP_ERROR",
        message: `NASA FIRMS request failed with HTTP ${response.status}.`,
        details: { status: response.status },
        fetchedAt,
        sourceUrl,
      };
    }
    const normalized = normalizeNasaFirmsFeatures(await response.json(), fetchedAt);
    if (!normalized.ok) return { status: "unavailable", ...normalized.error, fetchedAt, sourceUrl };
    if (normalized.value.length === 0) {
      return {
        status: "empty",
        fetchedAt,
        sourceUrl,
        reason: "NASA FIRMS returned no VIIRS thermal detections for this area and supported time window. This is not an all-clear.",
      };
    }
    return { status: "ready", data: normalized.value, fetchedAt, sourceUrl };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      status: "unavailable",
      code: timedOut ? "TIMEOUT" : aborted || options.signal?.aborted ? "ABORTED" : "NETWORK_ERROR",
      message: timedOut
        ? `NASA FIRMS did not respond within ${timeoutMs}ms.`
        : aborted || options.signal?.aborted
          ? "NASA FIRMS request was cancelled."
          : "NASA FIRMS could not be reached.",
      fetchedAt,
      sourceUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
}
