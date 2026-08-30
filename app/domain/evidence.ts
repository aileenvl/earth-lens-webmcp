import type { Coordinates, EvidenceRecord, InvestigationArea } from "./types.ts";

const EARTH_RADIUS_KM = 6371.0088;
const radians = (degrees: number) => degrees * Math.PI / 180;

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function filterEvidenceForArea(
  evidence: readonly EvidenceRecord[],
  area: InvestigationArea,
): EvidenceRecord[] {
  return evidence
    .filter((record) => distanceKm(area, record.coordinates) <= area.radiusKm)
    .toSorted((a, b) => b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id));
}
