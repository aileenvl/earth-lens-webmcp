# Implementation Plan: Earth Lens Hackathon Release

**Status:** Accepted on 2026-08-29
**Accepted specifications:** `docs/specs/`
**Task list:** `tasks/todo.md`

## Overview

Build Earth Lens as six dependency-ordered vertical slices: establish reliable
quality tooling and shared state; prove ArcGIS with one real USGS earthquake;
add the remaining providers with independent failure handling; expose the same
operations through WebMCP; complete human review and undo; then harden, publish,
record, and submit.

An accepted post-release evidence slice adds NASA LANCE/FIRMS VIIRS thermal
hotspots through ArcGIS Living Atlas without changing the 11-tool WebMCP
surface. The new layer uses the same typed evidence state as the human UI and
is therefore queryable, inspectable, hideable, and reversible by an agent.

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
- T15 — Add NASA VIIRS thermal-hotspot evidence

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
- NASA VIIRS 375 m product, FIRMS access, and ArcGIS query contract:
  https://www.earthdata.nasa.gov/data/tools/firms,
  https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf,
  https://www.arcgis.com/home/item.html?id=dece90af1a0242dcbf0ca36d30276aa3,
  and https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/

## Open questions

No product or architecture question blocks implementation. Public Sites access
and the final YouTube account are release operations tracked in T13–T14.

## Proposed plan: community outdoor context

**Status:** Accepted on 2026-09-03. The `outdoor-conditions` specification is
recorded in `docs/specs/SPEC-outdoor-conditions.md`.

### Outcome

Make Earth Lens answer “What is it like outside here today?” using the same
visible workspace the human and agent share. The experience keeps:

- Open-Meteo/CAMS modelled air quality;
- NASA VIIRS thermal hotspots;
- official SMN daily minimum/maximum temperature, rain, wind, gust, cloud cover,
  and sky forecast for Mexican municipalities.

The result is an evidence-backed planning explanation, not a safety verdict.
Each contributing source retains its own timestamp, geography, provenance, and
limitation. A nearby hotspot or registered facility never establishes a cause.

### Architecture decisions

- Add `smn` as a provider and `weather-forecast` as an evidence type; do not
  replace or reinterpret `nasa-firms` thermal detections.
- Fetch and decompress the nationwide SMN feed server-side. Cache it for about
  75 minutes so browsers do not repeatedly download the full municipality file.
- Normalize today plus the three-day outlook for the closest supported Mexican
  municipality. Outside Mexico, show explicit unsupported coverage
  while the existing worldwide sources continue to work.
- Derive the outdoor-planning summary in a pure domain function from available
  air-quality and weather records. Missing data produces a gap statement, never
  an all-clear.
- Reuse the 11 existing WebMCP tools. `query_selected_area`, source discovery,
  inspection, drafts, and the embedded assistant all receive the same new state;
  no chat-only fetch path and no hidden twelfth tool.
- Keep raw measurements visible beside the friendly explanation so a person can
  verify what the agent used.

### Dependency graph

```text
T16 approve outdoor-conditions contract
  -> T17 prove SMN server cache and parser
      -> T18 add typed SMN evidence to workspace
          -> T19 ship Outdoor conditions UI
              -> T20 expose the same evidence to agent/chat
                  -> T21 verify, document, and deploy

Later, separately:
T22 INEGI DENUE registered-place context
  -> T23 selected CENAPRED/CONAGUA risk context
```

### Critical path

1. **Contract first:** define Mexico-only coverage, four-day record cap, units,
   source/error states, and exact non-verdict language.
2. **Fail-fast data spike:** verify the compressed `method=1` response in the
   production runtime, cache behavior, decompression, and Monterrey municipality
   matching before changing UI state.
3. **One complete vertical slice:** SMN adapter -> shared workspace -> outdoor
   card -> WebMCP query -> embedded assistant answer.
4. **Judge-visible verification:** ask about Monterrey, change place, inspect
   contributing records, hide/show the source, and confirm the agent reacts to
   the same visible state.
5. **Only after that ships:** add DENUE and selected flood/landslide context.

### Judge-visible demo

1. A person focuses Monterrey and asks, “What is it like outside today?”
2. The agent reads current map state and explains AQI plus temperature,
   daily temperature range, rain chance, and wind using source timestamps.
3. The shared card highlights the same measurements and states what is missing.
4. The person changes the area or source visibility; the agent’s next answer
   changes because it reads the updated workspace rather than scraping the UI.
5. A VIIRS hotspot remains a distinct satellite detection and is never described
   as weather, a confirmed fire, a company action, or proof of causation.

### Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Nationwide SMN payload is large | Slow or wasteful requests | Server-side decompression and shared ~75-minute cache; bounded client response |
| SMN timestamps/fields drift | Misleading forecast | Validate every remote field and return unavailable on malformed data |
| Worldwide map implies worldwide SMN | Coverage confusion | Explicit “SMN municipal forecast: Mexico only” state; preserve global sources |
| Friendly copy becomes a safety claim | Trust and submission risk | Use planning cues with contributing facts and gaps; never say “safe” or “all clear” |
| Weather records crowd other evidence | Agent/UI context loss | Bound forecasts to four records and preserve at least one record per ready source |
| Nearby facility is treated as a cause | Defamation and evidence risk | Keep DENUE in a later context module with explicit non-causation language |

### Deferred scope

- SIMA/SINAICA scraping, because no supported official feed has been obtained.
- “Fracking” labels inferred from wells, proximity, or heat.
- Company responsibility, emissions attribution, emergency alerts, evacuation,
  publishing, sending, donating, or automated personal-safety decisions.
