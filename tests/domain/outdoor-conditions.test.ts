import assert from "node:assert/strict";
import test from "node:test";

import { deriveOutdoorConditions } from "../../app/domain/outdoor-conditions.ts";
import type { EvidenceRecord, SourceState } from "../../app/domain/types.ts";

const air: EvidenceRecord = {
  id: "open-meteo:25.7,-100.3,2026-09-03T23:00",
  provider: "open-meteo",
  sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
  coordinates: { latitude: 25.7, longitude: -100.3 },
  observedAt: "2026-09-03T23:00:00.000Z",
  fetchedAt: "2026-09-03T23:05:00.000Z",
  evidenceType: "air-quality",
  title: "US AQI 114 · modelled air quality",
  attributes: { usAqi: 114, dominantPollutant: "Ozone", pm2_5: 10.4, pm10: 11.4 },
  limitation: "Modelled conditions, not a local sensor measurement.",
};

const weather: EvidenceRecord = {
  id: "smn:19-39-20260903T00",
  provider: "smn",
  sourceUrl: "https://smn.conagua.gob.mx/es/web-service-api",
  coordinates: { latitude: 25.6647, longitude: -100.3109 },
  observedAt: "2026-09-03T06:00:00.000Z",
  fetchedAt: "2026-09-03T23:55:00.000Z",
  evidenceType: "weather-forecast",
  title: "Monterrey forecast · 20.1–36.7 °C",
  attributes: {
    forecastDay: 0,
    municipalityName: "Monterrey",
    minimumTemperatureC: 20.1,
    maximumTemperatureC: 36.7,
    precipitationProbabilityPercent: 50,
    precipitationMm: 1.3,
    windSpeedKmh: 6.1,
    gustSpeedKmh: 25.2,
    sky: "Poco nuboso",
  },
  limitation: "Official municipal forecast, not a station observation.",
};

const ready = (fetchedAt: string): SourceState => ({ status: "ready", fetchedAt, count: 1 });

test("combines air and weather evidence into transparent outdoor planning context", () => {
  const result = deriveOutdoorConditions({
    airQuality: air,
    weatherForecasts: [weather],
    airQualityState: ready(air.fetchedAt),
    weatherState: ready(weather.fetchedAt),
  });

  assert.equal(result.status, "ready");
  assert.equal(result.headline, "Plan with extra care outdoors");
  assert.match(result.summary, /AQI 114/i);
  assert.match(result.summary, /20\.1–36\.7 °C/);
  assert.deepEqual(result.evidenceIds, [air.id, weather.id]);
  assert.deepEqual(result.gaps, []);
  assert.doesNotMatch(`${result.headline} ${result.summary}`, /\bsafe\b|all[- ]clear/i);
});

test("keeps useful temperature context when air quality is unavailable", () => {
  const result = deriveOutdoorConditions({
    airQuality: null,
    weatherForecasts: [weather],
    airQualityState: { status: "unavailable", fetchedAt: air.fetchedAt, reason: "CAMS unavailable" },
    weatherState: ready(weather.fetchedAt),
  });

  assert.equal(result.status, "partial");
  assert.equal(result.headline, "Weather context is available");
  assert.match(result.summary, /20\.1–36\.7 °C/);
  assert.match(result.gaps.join(" "), /air quality/i);
  assert.deepEqual(result.evidenceIds, [weather.id]);
});

test("states Mexico-only weather coverage without discarding worldwide air quality", () => {
  const result = deriveOutdoorConditions({
    airQuality: air,
    weatherForecasts: [],
    airQualityState: ready(air.fetchedAt),
    weatherState: { status: "empty", fetchedAt: weather.fetchedAt, reason: "SMN coverage is limited to Mexico." },
  });

  assert.equal(result.status, "partial");
  assert.match(result.summary, /AQI 114/i);
  assert.match(result.gaps.join(" "), /limited to Mexico/i);
  assert.deepEqual(result.evidenceIds, [air.id]);
});

test("does not infer conditions when both sources are unavailable", () => {
  const result = deriveOutdoorConditions({
    airQuality: null,
    weatherForecasts: [],
    airQualityState: { status: "unavailable", fetchedAt: air.fetchedAt, reason: "CAMS unavailable" },
    weatherState: { status: "unavailable", fetchedAt: weather.fetchedAt, reason: "SMN unavailable" },
  });

  assert.equal(result.status, "unavailable");
  assert.equal(result.evidenceIds.length, 0);
  assert.match(result.summary, /cannot describe/i);
});
