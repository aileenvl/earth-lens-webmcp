import type { Coordinates, EvidenceRecord, ValidationResult } from "../domain/types.ts";
import { validateEvidenceRecord } from "../domain/validation.ts";
import type { SourceResult } from "./types.ts";

export const SMN_DAILY_SOURCE_URL = "https://smn.conagua.gob.mx/es/web-service-api";
export const SMN_DAILY_UPSTREAM_URL = "https://smn.conagua.gob.mx/tools/GUI/webservices/?method=1";

const MAX_FORECAST_DAYS = 4;
const MAX_COVERAGE_DISTANCE_KM = 200;

type JsonObject = Record<string, unknown>;

interface FetchOptions {
  fetchImpl?: typeof fetch;
  now?: () => string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

type SmnDailyRow = {
  cloudCoverPercent: number;
  sky: string;
  utcDifferenceHours: number;
  windDirection: string;
  windDirectionDegrees: number;
  localForecastTime: string;
  stateId: string;
  municipalityId: string;
  latitude: number;
  longitude: number;
  forecastDay: number;
  stateName: string;
  municipalityName: string;
  precipitationMm: number;
  precipitationProbabilityPercent: number;
  gustSpeedKmh: number;
  maximumTemperatureC: number;
  minimumTemperatureC: number;
  windSpeedKmh: number;
};

const invalid = <T>(message: string): ValidationResult<T> => ({
  ok: false,
  error: { code: "INVALID_RESPONSE", message },
});

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finiteStringNumber = (value: unknown): number | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const cleanText = (value: unknown, maxLength = 120): string | null => {
  if (typeof value !== "string") return null;
  const withoutControls = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? " " : character;
  }).join("");
  const cleaned = withoutControls.replace(/\s+/g, " ").trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
};

function parseRow(value: unknown): ValidationResult<SmnDailyRow> {
  if (!isObject(value)) return invalid("SMN returned a non-object forecast record.");
  const stateId = cleanText(value.ides, 2);
  const municipalityId = cleanText(value.idmun, 4);
  const stateName = cleanText(value.nes);
  const municipalityName = cleanText(value.nmun);
  const sky = cleanText(value.desciel);
  const windDirection = cleanText(value.dirvienc, 40);
  const localForecastTime = cleanText(value.dloc, 11);
  const latitude = finiteStringNumber(value.lat);
  const longitude = finiteStringNumber(value.lon);
  const utcDifferenceHours = finiteStringNumber(value.dh);
  const forecastDay = finiteStringNumber(value.ndia);
  const maximumTemperatureC = finiteStringNumber(value.tmax);
  const minimumTemperatureC = finiteStringNumber(value.tmin);
  const precipitationMm = finiteStringNumber(value.prec);
  const precipitationProbabilityPercent = finiteStringNumber(value.probprec);
  const windSpeedKmh = finiteStringNumber(value.velvien);
  const windDirectionDegrees = finiteStringNumber(value.dirvieng);
  const gustSpeedKmh = finiteStringNumber(value.raf);
  const cloudCoverPercent = finiteStringNumber(value.cc);

  if (
    !stateId || !municipalityId || !stateName || !municipalityName || !sky || !windDirection
    || !localForecastTime || latitude === null || longitude === null
    || utcDifferenceHours === null || forecastDay === null
    || maximumTemperatureC === null || minimumTemperatureC === null
    || precipitationMm === null || precipitationProbabilityPercent === null
    || windSpeedKmh === null || windDirectionDegrees === null
    || gustSpeedKmh === null || cloudCoverPercent === null
  ) {
    return invalid("SMN returned an incomplete or invalid daily forecast record.");
  }
  if (
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    || !Number.isInteger(forecastDay) || forecastDay < 0 || forecastDay > 20
    || utcDifferenceHours < -14 || utcDifferenceHours > 14
    || precipitationProbabilityPercent < 0 || precipitationProbabilityPercent > 100
    || cloudCoverPercent < 0 || cloudCoverPercent > 100
    || !/^\d{8}T\d{2}$/.test(localForecastTime)
  ) {
    return invalid("SMN returned a daily forecast record outside accepted ranges.");
  }

  return {
    ok: true,
    value: {
      cloudCoverPercent,
      sky,
      utcDifferenceHours,
      windDirection,
      windDirectionDegrees,
      localForecastTime,
      stateId,
      municipalityId,
      latitude,
      longitude,
      forecastDay,
      stateName,
      municipalityName,
      precipitationMm,
      precipitationProbabilityPercent,
      gustSpeedKmh,
      maximumTemperatureC,
      minimumTemperatureC,
      windSpeedKmh,
    },
  };
}

function forecastTime(row: SmnDailyRow): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})$/.exec(row.localForecastTime);
  if (!match) return null;
  const [, year, month, day, hour] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) + row.utcDifferenceHours,
  );
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function distanceKm(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number): number => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function recordFor(
  row: SmnDailyRow,
  selectedCoordinates: Coordinates,
  fetchedAt: string,
  sourceUpdatedAt: string,
): ValidationResult<EvidenceRecord> {
  const observedAt = forecastTime(row);
  if (!observedAt) return invalid("SMN returned an invalid local forecast timestamp.");
  const distanceFromSelectionKm = Number(distanceKm(selectedCoordinates, row).toFixed(2));
  return validateEvidenceRecord({
    id: `smn:${row.stateId}-${row.municipalityId}-${row.localForecastTime}`,
    provider: "smn",
    sourceUrl: SMN_DAILY_SOURCE_URL,
    coordinates: { latitude: row.latitude, longitude: row.longitude },
    observedAt,
    fetchedAt,
    evidenceType: "weather-forecast",
    title: `${row.municipalityName} forecast · ${row.minimumTemperatureC}–${row.maximumTemperatureC} °C`,
    attributes: {
      stateId: row.stateId,
      municipalityId: row.municipalityId,
      stateName: row.stateName,
      municipalityName: row.municipalityName,
      forecastDay: row.forecastDay,
      minimumTemperatureC: row.minimumTemperatureC,
      maximumTemperatureC: row.maximumTemperatureC,
      precipitationMm: row.precipitationMm,
      precipitationProbabilityPercent: row.precipitationProbabilityPercent,
      windSpeedKmh: row.windSpeedKmh,
      windDirection: row.windDirection,
      windDirectionDegrees: row.windDirectionDegrees,
      gustSpeedKmh: row.gustSpeedKmh,
      cloudCoverPercent: row.cloudCoverPercent,
      sky: row.sky,
      sourceUpdatedAt,
      distanceFromSelectionKm,
    },
    limitation: "Official SMN municipal forecast, not a station observation, emergency alert, or guarantee of conditions at a specific location.",
  });
}

export function normalizeSmnDailyForecast(
  value: unknown,
  selectedCoordinates: Coordinates,
  fetchedAt: string,
  sourceUpdatedAt = fetchedAt,
): SourceResult<EvidenceRecord[]> {
  if (!Array.isArray(value)) {
    return {
      status: "unavailable",
      code: "INVALID_RESPONSE",
      message: "SMN did not return a daily forecast list.",
      fetchedAt,
      sourceUrl: SMN_DAILY_SOURCE_URL,
    };
  }

  const validRows: SmnDailyRow[] = [];
  for (const candidate of value) {
    const row = parseRow(candidate);
    if (row.ok) validRows.push(row.value);
  }
  if (!validRows.length) {
    return {
      status: "unavailable",
      code: "INVALID_RESPONSE",
      message: "SMN returned no valid daily forecast records.",
      fetchedAt,
      sourceUrl: SMN_DAILY_SOURCE_URL,
    };
  }

  const nearest = validRows.reduce((closest, row) => {
    const distance = distanceKm(selectedCoordinates, row);
    return distance < closest.distance ? { row, distance } : closest;
  }, { row: validRows[0], distance: distanceKm(selectedCoordinates, validRows[0]) });

  if (nearest.distance > MAX_COVERAGE_DISTANCE_KM) {
    return {
      status: "empty",
      reason: "The official SMN municipal forecast does not cover this selected location. SMN coverage in Earth Lens is limited to Mexico.",
      fetchedAt,
      sourceUrl: SMN_DAILY_SOURCE_URL,
    };
  }

  const municipalityRows = validRows
    .filter((row) => row.stateId === nearest.row.stateId && row.municipalityId === nearest.row.municipalityId)
    .sort((left, right) => left.forecastDay - right.forecastDay)
    .slice(0, MAX_FORECAST_DAYS);
  const records: EvidenceRecord[] = [];
  for (const row of municipalityRows) {
    const record = recordFor(row, selectedCoordinates, fetchedAt, sourceUpdatedAt);
    if (!record.ok) {
      return {
        status: "unavailable",
        ...record.error,
        fetchedAt,
        sourceUrl: SMN_DAILY_SOURCE_URL,
      };
    }
    records.push(record.value);
  }

  return records.length
    ? { status: "ready", data: records, fetchedAt, sourceUrl: SMN_DAILY_SOURCE_URL }
    : {
        status: "empty",
        reason: "SMN returned no daily forecasts for the nearest supported municipality.",
        fetchedAt,
        sourceUrl: SMN_DAILY_SOURCE_URL,
      };
}

export function getSmnForecastUrl(coordinates: Coordinates): string {
  const query = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
  });
  return `/api/smn?${query.toString()}`;
}

function parseClientEnvelope(value: unknown, fallbackFetchedAt: string): SourceResult<EvidenceRecord[]> {
  if (!isObject(value) || typeof value.status !== "string") {
    return { status: "unavailable", code: "INVALID_RESPONSE", message: "Earth Lens returned an invalid SMN response.", fetchedAt: fallbackFetchedAt, sourceUrl: SMN_DAILY_SOURCE_URL };
  }
  const fetchedAt = typeof value.fetchedAt === "string" && Number.isFinite(Date.parse(value.fetchedAt))
    ? value.fetchedAt
    : fallbackFetchedAt;
  if (value.status === "ready" && Array.isArray(value.data) && value.data.length <= MAX_FORECAST_DAYS) {
    const records: EvidenceRecord[] = [];
    for (const candidate of value.data) {
      if (!isObject(candidate) || candidate.provider !== "smn" || candidate.evidenceType !== "weather-forecast") {
        return { status: "unavailable", code: "INVALID_RESPONSE", message: "Earth Lens returned an invalid SMN forecast record.", fetchedAt, sourceUrl: SMN_DAILY_SOURCE_URL };
      }
      const validated = validateEvidenceRecord(candidate as unknown as EvidenceRecord);
      if (!validated.ok) return { status: "unavailable", ...validated.error, fetchedAt, sourceUrl: SMN_DAILY_SOURCE_URL };
      records.push(validated.value);
    }
    return records.length
      ? { status: "ready", data: records, fetchedAt, sourceUrl: SMN_DAILY_SOURCE_URL }
      : { status: "empty", reason: "SMN returned no daily forecasts for this area.", fetchedAt, sourceUrl: SMN_DAILY_SOURCE_URL };
  }
  if (value.status === "empty" && typeof value.reason === "string" && value.reason.trim()) {
    return { status: "empty", reason: value.reason.slice(0, 300), fetchedAt, sourceUrl: SMN_DAILY_SOURCE_URL };
  }
  if (value.status === "unavailable" && typeof value.code === "string" && typeof value.message === "string") {
    return { status: "unavailable", code: value.code.slice(0, 80), message: value.message.slice(0, 300), fetchedAt, sourceUrl: SMN_DAILY_SOURCE_URL };
  }
  return { status: "unavailable", code: "INVALID_RESPONSE", message: "Earth Lens returned an invalid SMN response.", fetchedAt, sourceUrl: SMN_DAILY_SOURCE_URL };
}

export async function fetchSmnForecast(coordinates: Coordinates, options: FetchOptions = {}): Promise<SourceResult<EvidenceRecord[]>> {
  const fetchedAt = (options.now ?? (() => new Date().toISOString()))();
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const timeout = setTimeout(() => {
    timedOut = true;
    timeoutController.abort("timeout");
  }, timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;
  try {
    const response = await (options.fetchImpl ?? fetch)(getSmnForecastUrl(coordinates), {
      signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return { status: "unavailable", code: "HTTP_ERROR", message: `Earth Lens SMN request failed with HTTP ${response.status}.`, fetchedAt, sourceUrl: SMN_DAILY_SOURCE_URL };
    }
    return parseClientEnvelope(await response.json(), fetchedAt);
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      status: "unavailable",
      code: timedOut ? "TIMEOUT" : aborted || options.signal?.aborted ? "ABORTED" : "NETWORK_ERROR",
      message: timedOut ? `Earth Lens SMN request did not respond within ${timeoutMs}ms.` : aborted || options.signal?.aborted ? "Earth Lens SMN request was cancelled." : "Earth Lens could not load the SMN forecast.",
      fetchedAt,
      sourceUrl: SMN_DAILY_SOURCE_URL,
    };
  } finally {
    clearTimeout(timeout);
  }
}
