import type { Coordinates, EvidenceRecord, ValidationResult } from "../domain/types.ts";
import { validateEvidenceRecord } from "../domain/validation.ts";
import type { SourceResult } from "./types.ts";

type JsonObject = Record<string, unknown>;
interface Options { fetchImpl?: typeof fetch; now?: () => string; signal?: AbortSignal; timeoutMs?: number }
const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const invalid = <T>(message: string): ValidationResult<T> => ({ ok: false, error: { code: "INVALID_RESPONSE", message } });

export function getAirQualityUrl(coordinates: Coordinates): string {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(coordinates.latitude));
  url.searchParams.set("longitude", String(coordinates.longitude));
  url.searchParams.set("current", "pm2_5,pm10,us_aqi");
  url.searchParams.set("timezone", "GMT");
  return url.toString();
}

export function normalizeAirQuality(value: unknown, fetchedAt: string): ValidationResult<EvidenceRecord> {
  if (!isObject(value) || !isObject(value.current) || !isObject(value.current_units)) return invalid("Open-Meteo did not return current air-quality conditions.");
  const current = value.current;
  const units = value.current_units;
  if (typeof value.latitude !== "number" || typeof value.longitude !== "number" || typeof current.time !== "string") return invalid("Open-Meteo returned invalid air-quality coordinates or time.");
  for (const key of ["pm2_5", "pm10", "us_aqi"] as const) {
    if (typeof current[key] !== "number" || !Number.isFinite(current[key]) || typeof units[key] !== "string") return invalid(`Open-Meteo returned an invalid ${key} value or unit.`);
  }
  const observedAt = new Date(`${current.time}Z`);
  if (Number.isNaN(observedAt.getTime())) return invalid("Open-Meteo returned an invalid current timestamp.");
  const pm2_5 = current.pm2_5 as number; const pm10 = current.pm10 as number; const usAqi = current.us_aqi as number;
  const pm2_5Unit = units.pm2_5 as string; const pm10Unit = units.pm10 as string; const usAqiUnit = units.us_aqi as string;
  return validateEvidenceRecord({
    id: `open-meteo:${value.latitude},${value.longitude},${current.time}`,
    provider: "open-meteo",
    sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
    coordinates: { latitude: value.latitude, longitude: value.longitude },
    observedAt: observedAt.toISOString(), fetchedAt, evidenceType: "air-quality",
    title: `US AQI ${usAqi} · modelled air quality`,
    attributes: { pm2_5, pm2_5Unit, pm10, pm10Unit, usAqi, usAqiUnit, model: "CAMS" },
    limitation: "Modelled CAMS air-quality conditions are forecasts, not local sensor measurements. Values are spatial estimates and may differ from conditions at a specific location.",
  });
}

export async function fetchAirQuality(coordinates: Coordinates, options: Options = {}): Promise<SourceResult<EvidenceRecord>> {
  const sourceUrl = getAirQualityUrl(coordinates); const fetchedAt = (options.now ?? (() => new Date().toISOString()))();
  const timeoutController = new AbortController(); let timedOut = false; const timeoutMs = options.timeoutMs ?? 10_000;
  const timeout = setTimeout(() => { timedOut = true; timeoutController.abort("timeout"); }, timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutController.signal]) : timeoutController.signal;
  try {
    const response = await (options.fetchImpl ?? fetch)(sourceUrl, { signal, headers: { accept: "application/json" } });
    if (!response.ok) return { status: "unavailable", code: "HTTP_ERROR", message: `Open-Meteo request failed with HTTP ${response.status}.`, fetchedAt, sourceUrl };
    const normalized = normalizeAirQuality(await response.json(), fetchedAt);
    return normalized.ok ? { status: "ready", data: normalized.value, fetchedAt, sourceUrl } : { status: "unavailable", ...normalized.error, fetchedAt, sourceUrl };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return { status: "unavailable", code: timedOut ? "TIMEOUT" : aborted || options.signal?.aborted ? "ABORTED" : "NETWORK_ERROR", message: timedOut ? `Open-Meteo did not respond within ${timeoutMs}ms.` : aborted || options.signal?.aborted ? "Open-Meteo request was cancelled." : "Open-Meteo could not be reached.", fetchedAt, sourceUrl };
  } finally { clearTimeout(timeout); }
}
