import { describeUsAqi } from "./air-quality.ts";
import type { EvidenceId, EvidenceRecord, SourceState } from "./types.ts";

export type OutdoorConditions = {
  status: "ready" | "partial" | "unavailable";
  headline: string;
  summary: string;
  facts: readonly string[];
  gaps: readonly string[];
  evidenceIds: readonly EvidenceId[];
};

type OutdoorConditionsInput = {
  airQuality: EvidenceRecord | null;
  weatherForecasts: readonly EvidenceRecord[];
  airQualityState: SourceState;
  weatherState: SourceState;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function gapFor(label: string, state: SourceState): string {
  if (state.status === "empty" || state.status === "unavailable") return `${label}: ${state.reason}`;
  if (state.status === "loading") return `${label} is still loading.`;
  return `${label} is not available for this selection.`;
}

function weatherSummary(record: EvidenceRecord): string | null {
  const minimum = record.attributes.minimumTemperatureC;
  const maximum = record.attributes.maximumTemperatureC;
  if (!finite(minimum) || !finite(maximum)) return null;
  return `${minimum}–${maximum} °C`;
}

function airHeadline(aqi: number): string {
  if (aqi <= 100) return "Air and weather context are available";
  if (aqi <= 150) return "Plan with extra care outdoors";
  if (aqi <= 200) return "Consider reducing outdoor exertion";
  return "Check official guidance before outdoor activity";
}

export function deriveOutdoorConditions(input: OutdoorConditionsInput): OutdoorConditions {
  const weather = input.weatherForecasts.find((record) => record.attributes.forecastDay === 0) ?? input.weatherForecasts[0] ?? null;
  const aqiValue = input.airQuality?.attributes.usAqi;
  const aqi = finite(aqiValue) ? aqiValue : null;
  const temperature = weather ? weatherSummary(weather) : null;
  const facts: string[] = [];
  const gaps: string[] = [];
  const evidenceIds: EvidenceId[] = [];

  if (input.airQuality && aqi !== null) {
    const category = describeUsAqi(aqi);
    facts.push(`US AQI ${aqi} (${category.label})`);
    evidenceIds.push(input.airQuality.id);
  } else {
    gaps.push(gapFor("Air quality", input.airQualityState));
  }

  if (weather) {
    if (temperature) facts.push(`Forecast temperature ${temperature}`);
    if (finite(weather.attributes.precipitationProbabilityPercent)) facts.push(`Rain chance ${weather.attributes.precipitationProbabilityPercent}%`);
    if (finite(weather.attributes.gustSpeedKmh)) facts.push(`Gusts up to ${weather.attributes.gustSpeedKmh} km/h`);
    if (typeof weather.attributes.sky === "string" && weather.attributes.sky.trim()) facts.push(`Sky: ${weather.attributes.sky.trim()}`);
    evidenceIds.push(weather.id);
  } else {
    gaps.push(gapFor("Official weather forecast", input.weatherState));
  }

  if (evidenceIds.length === 0) {
    return {
      status: "unavailable",
      headline: "Outdoor conditions are unavailable",
      summary: "Earth Lens cannot describe current outdoor conditions from the available sources.",
      facts,
      gaps,
      evidenceIds,
    };
  }

  const summary = [
    aqi === null ? null : `AQI ${aqi}`,
    temperature ? `forecast temperature ${temperature}` : null,
  ].filter((value): value is string => value !== null).join("; ");

  return {
    status: gaps.length === 0 ? "ready" : "partial",
    headline: aqi === null ? "Weather context is available" : airHeadline(aqi),
    summary: `${summary}. Forecast and model evidence are planning context, not a safety verdict.`,
    facts,
    gaps,
    evidenceIds,
  };
}
