export type PlaceCandidate = { label: string; latitude: number; longitude: number; score: number; type: string };
export type PlaceResolution =
  | { status: "resolved"; candidate: PlaceCandidate }
  | { status: "ambiguous"; candidates: PlaceCandidate[] }
  | { status: "not-found"; reason: string }
  | { status: "unavailable"; reason: string };

const endpoint = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function parseCandidate(value: unknown): PlaceCandidate | null {
  if (!isRecord(value) || typeof value.address !== "string" || !finite(value.score) || !isRecord(value.location)) return null;
  const { x, y } = value.location;
  if (!finite(x) || !finite(y) || x < -180 || x > 180 || y < -90 || y > 90) return null;
  const type = isRecord(value.attributes) && typeof value.attributes.Addr_type === "string" ? value.attributes.Addr_type : "Place";
  return { label: value.address.slice(0, 160), latitude: y, longitude: x, score: value.score, type };
}

export async function resolvePlace(query: string, options: { fetcher?: typeof fetch; signal?: AbortSignal; near?: { latitude: number; longitude: number } } = {}): Promise<PlaceResolution> {
  const normalized = query.trim();
  if (normalized.length < 2 || normalized.length > 160) throw new Error("Place query must contain 2 to 160 characters.");
  const url = new URL(endpoint);
  url.searchParams.set("singleLine", normalized);
  url.searchParams.set("outFields", "Addr_type,Match_addr");
  url.searchParams.set("maxLocations", "5");
  url.searchParams.set("f", "json");
  try {
    const response = await (options.fetcher ?? fetch)(url, { signal: options.signal });
    if (!response.ok) return { status: "unavailable", reason: "ArcGIS place search is temporarily unavailable." };
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.candidates)) return { status: "unavailable", reason: "ArcGIS place search returned an invalid response." };
    const candidates = body.candidates.map(parseCandidate).filter((candidate): candidate is PlaceCandidate => candidate !== null && candidate.score >= 80);
    if (candidates.length === 0) return { status: "not-found", reason: "No valid place candidates were returned." };
    const locality = candidates.find((candidate) => candidate.type === "Locality");
    const ranked = locality ? [locality, ...candidates.filter((candidate) => candidate !== locality)] : candidates;
    const competing = ranked.filter((candidate) => candidate.type === ranked[0].type && ranked[0].score - candidate.score < 3);
    const sameMetroArea = competing.every((candidate) => distanceKm(ranked[0], candidate) <= 50);
    if (competing.length > 1 && !sameMetroArea && options.near && finite(options.near.latitude) && finite(options.near.longitude)) {
      const near = options.near;
      const representatives: PlaceCandidate[] = [];
      for (const candidate of [...competing].sort((left, right) => distanceKm(near, left) - distanceKm(near, right))) {
        if (!representatives.some((item) => item.label.toLocaleLowerCase() === candidate.label.toLocaleLowerCase())) representatives.push(candidate);
      }
      if (representatives.length > 1 && distanceKm(near, representatives[1]) - distanceKm(near, representatives[0]) >= 100) return { status: "resolved", candidate: representatives[0] };
    }
    return competing.length > 1 && !sameMetroArea ? { status: "ambiguous", candidates: competing.slice(0, 5) } : { status: "resolved", candidate: ranked[0] };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { status: "unavailable", reason: "Place search was cancelled." };
    return { status: "unavailable", reason: "ArcGIS place search is temporarily unavailable." };
  }
}
import { distanceKm } from "../domain/evidence.ts";
