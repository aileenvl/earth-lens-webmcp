# Implementation Plan: Earth Lens Hackathon Release

**Status:** Proposed for review
**Accepted specifications:** `docs/specs/`
**Task list:** `tasks/todo.md`

## Overview

Build Earth Lens as six dependency-ordered vertical slices: establish reliable
quality tooling and shared state; prove ArcGIS with one real USGS earthquake;
add the remaining providers with independent failure handling; expose the same
operations through WebMCP; complete human review and undo; then harden, publish,
record, and submit.

## Architecture decisions

- ArcGIS Maps SDK for JavaScript 5.1 components are the map presentation layer.
- ArcGIS core geometry/layer APIs provide geodesic circles and spatial queries.
- One typed domain store and operation surface serves both React and WebMCP.
- Provider adapters validate remote data into one evidence contract.
- Expected provider failures are values, not uncaught exceptions.
- Agent mutations are visible, attributed, revisioned, and reversible.
- The situation lens remains a human-reviewed draft with no outbound action.

## Dependency graph

```text
T01 quality baseline
 └── T02 workspace contracts
      ├── T03 USGS adapter ── T04 ArcGIS shell ── T05 live USGS slice
      │                                         ├── T06 NASA EONET
      │                                         └── T07 air quality
      │                                              │
      └────────────────────────────────────────────── T08 provider resilience
                                                     │
                                                     T09 WebMCP read tools
                                                      └── T10 mutation + undo
                                                           └── T11 review draft
                                                                └── T12 hardening
                                                                     └── T13 release
                                                                          └── T14 submission
```

## Task index

### Foundation and first vertical slice

- T01 — Repair the development and quality baseline
- T02 — Define and test workspace contracts
- T03 — Normalize live USGS evidence
- T04 — Build the accessible ArcGIS shell
- T05 — Connect the live USGS vertical slice

### Complete evidence

- T06 — Add NASA EONET evidence
- T07 — Add Open-Meteo/CAMS air quality
- T08 — Prove partial failure, cancellation, and stale-request safety

### Human-agent collaboration

- T09 — Register WebMCP discovery and read tools
- T10 — Add visible WebMCP mutations and undo
- T11 — Add coverage analysis and situation-lens review

### Release

- T12 — Run accessibility, security, performance, and browser hardening
- T13 — Publish and verify the release candidate
- T14 — Record, audit, and submit the hackathon entry

## Checkpoints

1. After T01–T02: all quality gates run and the domain contract is stable.
2. After T03–T05: a human can inspect a real USGS event on ArcGIS.
3. After T06–T08: all three providers work and fail independently.
4. After T09–T11: the exact human-agent demo succeeds end to end.
5. After T12–T14: public artifacts pass a fresh-session submission audit.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ArcGIS 5.1 bundle or custom elements conflict with server rendering | High | Browser-only loader, minimal imports, text fallback, prove in T04 before expanding |
| Public provider CORS, latency, or shape changes | High | Boundary validation, abort/timeout, fixtures, independent source states |
| Experimental WebMCP registration changes | High | Feature detection, current specification, contract tests, fresh-browser verification |
| Existing starter render test is obsolete | Medium | Replace only after a failing test demonstrates the mismatch in T01 |
| npm quality-tool resolution is slow | Medium | Resolve packages individually, keep slow browser checks at preview/release stages |
| Sites deployment remains owner-only | High | Make judge access a blocking T13 acceptance criterion and keep rollback deployment |
| Demo exceeds three minutes | Medium | Script around one collaboration story and rehearse twice before recording |

## Source-verified implementation notes

- ArcGIS 5.1 component architecture and migration guidance:
  https://developers.arcgis.com/javascript/latest/v5-1/
- ArcGIS GeoJSON and spatial query support:
  https://developers.arcgis.com/javascript/latest/references/core/layers/GeoJSONLayer/
  and https://developers.arcgis.com/javascript/latest/query-filter/
- WebMCP registration contract:
  https://github.com/webmachinelearning/webmcp/blob/main/index.bs
- USGS GeoJSON contract:
  https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
- NASA EONET v3 contract and limitation:
  https://eonet.gsfc.nasa.gov/docs/v3 and
  https://eonet.gsfc.nasa.gov/what-is-eonet
- Open-Meteo/CAMS contract and attribution:
  https://open-meteo.com/en/docs/air-quality-api

## Open questions

No product or architecture question blocks implementation. Public Sites access
and the final YouTube account are release operations tracked in T13–T14.
