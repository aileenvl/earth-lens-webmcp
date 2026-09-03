import { describeUsAqi, getAqiActivityGuidance, getUsAqiTone } from "../domain/air-quality.ts";
import type { EvidenceRecord } from "../domain/types.ts";

export function AirQualityCard({ evidence, selected, onInspect }: { evidence: EvidenceRecord; selected: boolean; onInspect: () => void }) {
  const description = describeUsAqi(Number(evidence.attributes.usAqi));
  const activity = getAqiActivityGuidance(Number(evidence.attributes.usAqi));
  const tone = getUsAqiTone(Number(evidence.attributes.usAqi));
  return (
    <button className={`airQualityCard aqi-${tone} ${selected ? "selected" : ""}`} onClick={onInspect} aria-label={`Inspect current modelled air quality: AQI ${evidence.attributes.usAqi}, ${description.label}`}>
      <div className="airQualityTop"><span>Current model estimate</span><em>Not a sensor</em></div>
      <div className="aqiReading"><strong>{String(evidence.attributes.usAqi)}</strong><span><b>US AQI · {description.label}</b><small>{description.guidance}</small></span></div>
      <div className="activityGuidance"><span>Outdoor planning cue</span><strong>{activity.headline}</strong><p>{activity.general}</p><small>Sensitive people: {activity.sensitive}</small></div>
      <dl className="pollutantGrid">
        <div><dt>PM₂.₅</dt><dd>{String(evidence.attributes.pm2_5)} <small>{String(evidence.attributes.pm2_5Unit)}</small></dd></div>
        <div><dt>PM₁₀</dt><dd>{String(evidence.attributes.pm10)} <small>{String(evidence.attributes.pm10Unit)}</small></dd></div>
        <div><dt>Scope</dt><dd>Map center</dd></div>
      </dl>
      {evidence.attributes.dominantPollutant && <span className="airQualityDriver">Likely AQI driver: <strong>{String(evidence.attributes.dominantPollutant)}</strong> ({String(evidence.attributes.dominantPollutantAqi)} component AQI)</span>}
      <span className="airQualityTime">Model time {new Date(evidence.observedAt).toLocaleString()} · Current only</span>
    </button>
  );
}
