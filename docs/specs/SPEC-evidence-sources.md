# Spec: `evidence-sources`

**Status:** Accepted
**Conventions:** `SPEC-CONVENTIONS.md`

## Objective

Fetch, validate, normalize, and explain three public environmental sources while
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

Every adapter accepts an `AbortSignal`, validates status and response shape,
caps records, sanitizes display strings/URLs, and returns `SourceResult`.

Official sources:

- https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
- https://eonet.gsfc.nasa.gov/docs/v3
- https://eonet.gsfc.nasa.gov/what-is-eonet
- https://open-meteo.com/en/docs/air-quality-api

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
