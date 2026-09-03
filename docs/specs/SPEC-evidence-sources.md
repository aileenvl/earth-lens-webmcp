# Spec: `evidence-sources`

**Status:** Accepted
**Conventions:** `SPEC-CONVENTIONS.md`

## Objective

Fetch, validate, normalize, and explain four public environmental sources while
keeping provider failures independent.

## Commands and structure

Adapters and schemas belong in `app/sources/<provider>/`; shared normalization
belongs in `app/sources/core/`; fixtures and tests belong in `tests/sources/`.

## Source contracts

| Provider | Request | Evidence type | Required interpretation |
|---|---|---|---|
| USGS | Official all-earthquakes GeoJSON feeds for 24h, 7d, or 30d | `observed_preliminary` or `observed_reviewed` from status | Magnitude/location may be revised |
| NASA EONET v3 | `/events/geojson` with supported time/status/bbox filters | `aggregated_event` | General-information geometry may be approximate and is not an official event extent |
| Open-Meteo/CAMS | `/v1/air-quality` for selected WGS84 coordinate and current PM2.5, PM10, and US AQI | `modelled` | Model grid/forecast, not a neighbourhood sensor measurement |
| NASA LANCE/FIRMS VIIRS via ArcGIS Living Atlas | FeatureServer layer `0/query`, filtered by selected WGS84 point/radius and `hours_old`, capped at 200 newest records | `satellite_detection` | A roughly 375 m thermal-anomaly pixel, not a confirmed wildfire, perimeter, cause, or local safety verdict; NRT data may be delayed, incomplete, or false positive |

Every adapter accepts an `AbortSignal`, validates status and response shape,
caps records, sanitizes display strings/URLs, and returns `SourceResult`.

Official sources:

- https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
- https://eonet.gsfc.nasa.gov/docs/v3
- https://eonet.gsfc.nasa.gov/what-is-eonet
- https://open-meteo.com/en/docs/air-quality-api
- https://www.earthdata.nasa.gov/data/tools/firms
- https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf
- https://www.arcgis.com/home/item.html?id=dece90af1a0242dcbf0ca36d30276aa3
- https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/

### NASA VIIRS adapter details

- Provider ID: `nasa-firms`; evidence type: `thermal-hotspot`; layer ID:
  `thermal-hotspots`.
- Query only the fixed public ArcGIS layer URL with `GET`; send the selected
  center as an `esriGeometryPoint`, the validated radius in kilometres, WGS84
  input/output spatial references, a cacheable `hours_old` predicate, explicit
  fields, newest-first ordering, and a 200-record maximum.
- Map `OBJECTID`, WGS84 coordinates, `acq_time`, satellite, confidence, FRP,
  day/night, scan/track pixel size, brightness temperatures, version, and
  `hours_old`. Reject malformed geometry, provenance, timestamps, enums, or
  non-finite values at the adapter boundary.
- `24h` requests use `hours_old <= 24`; `7d` and `30d` use the feed's maximum
  seven-day history (`hours_old <= 168`). The 30-day UI and tool results must
  disclose that this provider only covers the latest seven days.
- Construct record links from the fixed service URL and validated numeric
  `OBJECTID`; never render provider HTML.
- Loading, empty, unavailable, and ready states remain independent. Empty means
  no matching detections were returned, never that no fire or hazard exists.

## Testing strategy

Use captured minimal fixtures for valid, malformed, empty, partial, duplicate,
timeout, abort, and HTTP-error responses. Network calls are not unit tests.

## Boundaries

- Always show provider, timestamp, evidence type, limitation, and live status.
- Ask before adding another provider or server proxy.
- Never equate an empty/unavailable response with absence of hazard.

## Success criteria

- Valid records normalize to one `EvidenceRecord` contract.
- One provider can fail while the other evidence remains usable.
- Stale requests cannot overwrite a newer area or time selection.
