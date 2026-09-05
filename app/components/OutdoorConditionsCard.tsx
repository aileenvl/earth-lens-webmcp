import type { OutdoorConditions } from "../domain/outdoor-conditions.ts";
import type { EvidenceRecord, SourceState } from "../domain/types.ts";

const value = (input: unknown, suffix = "") => typeof input === "number" && Number.isFinite(input) ? `${input}${suffix}` : "Not available";

export function OutdoorConditionsCard({
  conditions,
  weather,
  weatherState,
  onInspectWeather,
}: {
  conditions: OutdoorConditions;
  weather: EvidenceRecord | null;
  weatherState: SourceState;
  onInspectWeather: () => void;
}) {
  return (
    <section className={`outdoorConditions ${conditions.status}`} aria-label="Outdoor conditions planning context">
      <div className="outdoorConditionsTop"><span>Official SMN municipal forecast</span><em>{conditions.status === "ready" ? "2 sources" : "Partial context"}</em></div>
      <h3>{conditions.headline}</h3>
      <p>{conditions.summary}</p>
      {weatherState.status === "loading" && <p role="status">Loading official temperature, rain, wind, and sky forecast…</p>}
      {weather && <>
        <dl className="weatherFactGrid">
          <div><dt>Temperature</dt><dd>{value(weather.attributes.minimumTemperatureC, "°")}–{value(weather.attributes.maximumTemperatureC, " °C")}</dd></div>
          <div><dt>Rain chance</dt><dd>{value(weather.attributes.precipitationProbabilityPercent, "%")}</dd></div>
          <div><dt>Wind / gusts</dt><dd>{value(weather.attributes.windSpeedKmh)} / {value(weather.attributes.gustSpeedKmh, " km/h")}</dd></div>
          <div><dt>Sky</dt><dd>{typeof weather.attributes.sky === "string" ? weather.attributes.sky : "Not available"}</dd></div>
        </dl>
        <button type="button" className="weatherInspect" onClick={onInspectWeather}>Inspect SMN forecast and limits →</button>
        <small>Valid {new Date(weather.observedAt).toLocaleString()} · refreshed {new Date(weather.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
      </>}
      {conditions.gaps.length > 0 && <ul>{conditions.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>}
      <span className="planningCaution">Forecast and model context—not a safety verdict or official alert.</span>
    </section>
  );
}
