# Capability Map: Earth Lens Submission

**Status:** Accepted
**Date:** 2026-08-29

This map separates the hackathon release into independently testable modules.
Module IDs are stable once this proposal is accepted.

| Module ID | Responsibility | Depends on |
|---|---|---|
| `workspace-core` | Typed shared investigation state, source metadata, selection geometry, activity history, and situation-lens draft state | — |
| `arcgis-map` | ArcGIS 2D map, no-key basemap, pan/zoom, area selection, evidence rendering, popup inspection, and keyboard-accessible non-map controls | `workspace-core` |
| `evidence-sources` | Fetch and normalize USGS earthquakes, NASA EONET events, and Open-Meteo/CAMS air quality with provenance, freshness, uncertainty, cancellation, and partial failure | `workspace-core` |
| `place-resolution` | Resolve worldwide place names through ArcGIS World Geocoding into validated WGS84 investigation areas without silently choosing ambiguous matches | `workspace-core`, `arcgis-map` |
| `webmcp-tools` | Register semantic WebMCP tools that read and mutate the same domain operations used by the visible UI | `workspace-core`, `arcgis-map`, `evidence-sources` |
| `collaboration-review` | Activity log, reversible agent changes, evidence-coverage analysis, and human-confirmed situation-lens drafting | `webmcp-tools` |
| `release-submission` | Automated checks, public deployment, reproducible repository, attributions, demo script/video, and Devpost submission audit | `arcgis-map`, `evidence-sources`, `collaboration-review` |

## Dependency direction

```text
workspace-core
├── arcgis-map ───────────────┐
├── evidence-sources ─────────┼── webmcp-tools
└─────────────────────────────┘         │
                                       ▼
                            collaboration-review
                                       │
                                       ▼
                              release-submission
```

## Build order

1. `workspace-core`
2. `arcgis-map` with one live USGS vertical slice
3. `evidence-sources` for NASA EONET and Open-Meteo/CAMS
4. `webmcp-tools`
5. `collaboration-review`
6. `release-submission`

## Scope decisions represented here

- ArcGIS Maps SDK for JavaScript is the geospatial engine.
- The first end-to-end slice uses a real USGS earthquake, not illustrative data.
- The UI and WebMCP tools share typed domain operations; tool calls do not simulate clicks.
- Agent changes are visible and reversible. A situation lens remains a draft until a person confirms it.
- The release does not predict disasters, issue alerts, recommend evacuation, publish content, transmit personal information, or process contributions.
- Authentication, persistent accounts, paid services, and additional environmental providers are post-submission work.
- Worldwide place-name resolution is accepted for the release; ambiguous matches fail with visible choices rather than model-guessed coordinates.

## Review gate

This capability map was accepted on 2026-08-29. Each module receives a specification with
commands, structure, interfaces, tests, boundaries, and measurable success
criteria. Implementation does not begin before that specification and its task
list are reviewed.
