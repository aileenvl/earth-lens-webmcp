# Changelog

## Unreleased

### Fixed

- Made plural “show these thermal detections” requests keep the collection map
  visible, with a mapped-record count and explicit labels for nearby overlapping
  VIIRS points instead of opening one record over the map.
- Preserved one record from every available official evidence source when the
  assistant payload reaches its 50-record limit, so a large VIIRS result cannot
  crowd current air quality out of an outdoor-planning answer.
- Made current modelled air quality understandable at a glance with the US AQI
  category, PM2.5, PM10, model time, map-center scope, and an explicit
  “not a sensor” label.
- Renamed the shared time control to “Event history” so it no longer implies
  that a current air-quality estimate represents 7 or 30 days.
- Supplied complete pollutant facts to the assistant and prevented it from
  describing current air quality as historical coverage.

### Added

- Added worldwide NASA LANCE/FIRMS VIIRS thermal-hotspot evidence through the
  public ArcGIS Living Atlas FeatureServer.
- Added confidence, satellite, fire-radiative-power, day/night, pixel-size,
  observation-time, provenance, and false-positive context to the shared map,
  text UI, embedded assistant, WebMCP workspace, coverage analysis, and drafts.
- Kept the WebMCP contract at eleven tools by extending the existing semantic
  layer, query, inspection, and undo operations.

## 1.0.0-rc.2 — 2026-08-30

- Replaced illustrative prototype data with live USGS, NASA EONET, and
  Open-Meteo/CAMS evidence.
- Added the ArcGIS 5.1 investigation map and accessible non-map controls.
- Added ten strict WebMCP tools over one shared, revisioned workspace.
- Added visible and reversible agent mutations with protection for newer human
  corrections.
- Added provenance-rich situation-lens drafts and evidence-coverage analysis.
- Added source failure isolation, request cancellation, attribution, safety
  boundaries, tests, accessibility checks, and performance budgets.

Rollback: the annotated `v1.0.0-rc.1` tag identifies this source release, and
Sites retains the previously deployed checkpoints for rollback.
