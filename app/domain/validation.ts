import type {
  EvidenceRecord,
  InvestigationArea,
  ValidationResult,
} from "./types.ts";

const invalid = <T>(code: string, message: string): ValidationResult<T> => ({
  ok: false,
  error: { code, message },
});

const isIsoDate = (value: string): boolean =>
  typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  && !Number.isNaN(Date.parse(value));

export function validateInvestigationArea(value: InvestigationArea): ValidationResult<InvestigationArea> {
  if (!Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) {
    return invalid("INVALID_LATITUDE", "Latitude must be between -90 and 90 degrees.");
  }
  if (!Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) {
    return invalid("INVALID_LONGITUDE", "Longitude must be between -180 and 180 degrees.");
  }
  if (!Number.isFinite(value.radiusKm) || value.radiusKm <= 0 || value.radiusKm > 2_000) {
    return invalid("INVALID_RADIUS", "Radius must be greater than 0 and no more than 2,000 kilometres.");
  }
  if (!value.label.trim()) return invalid("INVALID_LABEL", "The investigation area needs a label.");
  if (value.updatedBy !== "human" && value.updatedBy !== "agent") {
    return invalid("INVALID_ACTOR", "The investigation area must identify who updated it.");
  }
  return { ok: true, value: structuredClone(value) };
}

export function validateEvidenceRecord(value: EvidenceRecord): ValidationResult<EvidenceRecord> {
  const coordinates = validateInvestigationArea({
    ...value.coordinates,
    radiusKm: 1,
    label: "Evidence coordinate",
    updatedBy: "agent",
  });
  if (!coordinates.ok) return invalid(coordinates.error.code, coordinates.error.message);
  if (!value.id.startsWith(`${value.provider}:`) || value.id.length <= value.provider.length + 1) {
    return invalid("INVALID_EVIDENCE_ID", "Evidence ID must be namespaced by its provider.");
  }
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(value.sourceUrl);
  } catch {
    return invalid("INVALID_SOURCE_URL", "Evidence must include a valid HTTPS source URL.");
  }
  if (sourceUrl.protocol !== "https:") {
    return invalid("INVALID_SOURCE_URL", "Evidence must include a valid HTTPS source URL.");
  }
  if (!isIsoDate(value.observedAt) || !isIsoDate(value.fetchedAt)) {
    return invalid("INVALID_TIMESTAMP", "Evidence timestamps must be valid ISO-compatible dates.");
  }
  if (!value.title.trim() || !value.limitation.trim()) {
    return invalid("INCOMPLETE_PROVENANCE", "Evidence needs a title and an explicit limitation.");
  }
  return { ok: true, value: structuredClone(value) };
}
