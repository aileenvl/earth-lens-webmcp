# Earth Lens implementation

## Product boundary

Earth Lens is a shared environmental evidence workspace, not an autonomous
emergency system. The human selects the geographic context and can revise every
agent change. The agent receives semantic tools for evidence work and can only
produce a reviewable draft; there is no send or publish operation.

## Data flow

1. Area and time controls update the revisioned workspace.
2. Independent adapters request USGS, NASA EONET, Open-Meteo/CAMS, NASA
   LANCE/FIRMS VIIRS, and Mexico's SMN/CONAGUA municipal forecast data through
   public HTTPS endpoints.
3. Each adapter validates and normalizes provenance into a common evidence
   contract. Abort signals and revision checks discard stale responses.
4. ArcGIS and the textual evidence surface render the same normalized records.
5. WebMCP tools call the same domain operations as the human UI.
6. The embedded assistant maps natural language to the same allowlisted tool
   executors; structured output is validated again before any action runs.
7. Coverage analysis and lens drafting use only the current selected area.

The VIIRS adapter queries the public ArcGIS Living Atlas FeatureServer with the
same validated point, radius, and event window that the person and agent share.
It requests explicit fields, uses cacheable `hours_old` filters, caps results at
200, and normalizes each detection into the same provenance-rich evidence
contract. The 30-day workspace state discloses the source's seven-day limit.
Every surface calls it a thermal hotspot rather than treating a satellite heat
anomaly as a confirmed wildfire.

The SMN boundary runs on the server, decompresses and validates the official
nationwide feed, requests an approximately 75-minute server cache when the
hosting runtime permits it, and returns at most four forecast days for the
nearest supported municipality. The browser never receives the nationwide
payload. On Sites, where the default Worker cache is unavailable, the adapter
safely falls back to a fresh upstream request and a five-minute client cache.
Weather temperature remains distinct from VIIRS land-surface thermal detections
and from modelled CAMS air quality.

## Natural-language interaction

Visitors can ask questions directly in the public app without signing in. A bounded evidence
snapshot and short conversation history go to the OpenAI Responses API with
storage disabled. The API key remains server-side. Both request and model output
are validated, actions are restricted to the eleven Earth Lens operations, and a
question does not trigger a mutation unless the person explicitly asks for one.

## WebMCP implementation

`app/webmcp/tools.ts` defines the eleven public tools, strict JSON schemas, runtime
validation, and one result envelope. `app/webmcp/register.ts` feature-detects
`document.modelContext`, registers each tool exactly once, and aborts execution
on cleanup. `app/page.tsx` binds those tools to current React and domain state.

Read tools expose state, sources, selected-area evidence, individual evidence,
and coverage. Mutation tools update visible area, time, and layers; record an
agent revision; and return whether the change is reversible. The undo stack is
cleared by a newer human correction so an agent cannot silently overwrite it.

## Review artifact

A situation lens contains area, time window, summary, explicit evidence gaps,
unique citations, creator, creation time, revision, and immutable `draft`
status. Human revision creates another draft revision and preserves citations.
No tool has an outbound side effect.

## Verification snapshot — 2026-08-30

- 32 logic tests plus 3 rendered-source tests passed.
- Overall logic coverage: 96.69% lines, 74.79% branches, 85.21% functions.
- Dependency architecture and secret scans passed.
- No high-severity npm audit finding; four moderate findings remain in the
  development-only Drizzle toolchain and require a breaking forced upgrade.
- Production axe scan: zero WCAG A/AA/2.1 AA violations detected.
- Production LCP: 1,676 ms; CLS: 0.
- Production browser: all three live signals loaded and no console warnings or
  errors were observed.

## Browser support note

The Codex in-app browser and WebMCP-enabled Chrome can discover the eleven
registered tools. Browsers without the experimental API retain the complete
human interface.

## VIIRS verification snapshot — 2026-09-03

- 61 logic tests pass with 95.24% overall line coverage.
- The VIIRS adapter has 96.14% line coverage and covers URL construction,
  normalization, record caps, malformed data, empty data, HTTP failure, and
  cancellation.
- TypeScript and ESLint checks completed without reported diagnostics.
- The WebMCP surface remains eleven tools; `thermal-hotspots` is an additive
  layer accepted by the existing visibility, query, inspection, coverage,
  undo, and drafting tools.

## SMN and place-resolution snapshot — 2026-09-04

- 76 logic tests and 10 rendered-source tests pass; overall logic line coverage
  is 94.66%.
- TypeScript, ESLint, production build, dependency architecture, secret scans,
  and the high-severity dependency audit pass.
- A real WebMCP `focus_place` call resolves Escobedo to Escobedo, Nuevo León,
  updates the visible heading/map, and refreshes CAMS air quality plus the
  official General Escobedo SMN forecast.
- The WebMCP surface remains eleven tools; `weather-forecast` participates in
  the existing state, layer, query, inspection, coverage, and drafting tools.
