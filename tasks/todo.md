# Earth Lens Task List

Each task must satisfy `CONSTRAINTS.md`. Tasks are ordered by dependency and no
task may silently expand beyond its listed module or files.

## T01 — Repair the development and quality baseline

**Description:** Make the supported Node runtime, dependency install, starter
tests, and approved quality commands reproducible before feature code begins.

**Acceptance criteria:**

- [x] Node 22.13+ installs dependencies without an engine conflict.
- [x] The obsolete starter-skeleton test first fails against Earth Lens and is
      replaced by a render smoke test for the current application shell.
- [x] Typecheck, lint, floor guard, tests, dependency audit, architecture check,
      axe, the browser performance budget, and redacted Gitleaks commands are
      installed and runnable at their declared lifecycle stages.

**Verification:**

- [x] `npm run check:fast`
- [x] `npm test`
- [x] `npm audit --audit-level=high`
- [x] `npm run check:architecture`
- [x] `npm run check:secrets`
- [x] `npm run check:a11y -- http://localhost:3000`
- [x] `npm run check:performance -- http://localhost:3000`

**Dependencies:** None
**Files likely touched:** `package.json`, `package-lock.json`,
`tests/rendered-html.test.mjs`, `.dependency-cruiser.cjs`, `CONSTRAINTS.md`
**Estimated scope:** Medium (5 files)

## T02 — Define and test workspace contracts

**Description:** Implement framework-independent state, evidence, source-result,
activity, error, revision, and reversible-operation contracts.

**Acceptance criteria:**

- [x] Invalid coordinates, radius, provenance, and state transitions are rejected.
- [x] Human and agent operations produce attributed revisions.
- [x] Every reversible mutation produces an inverse that restores exact state.

**Verification:**

- [x] Focused domain tests pass with at least 80% changed-line coverage.
- [x] `npm run check:fast`

**Dependencies:** T01
**Files likely touched:** `app/domain/types.ts`, `app/domain/validation.ts`,
`app/domain/workspace.ts`, `tests/domain/workspace.test.ts`
**Estimated scope:** Medium (4 files)

## Checkpoint A — Foundation

- [x] T01 and T02 acceptance criteria pass.
- [x] Quality checks finish within their agreed budgets or have measured evidence.
- [x] Human reviews the first domain contract before ArcGIS integration.

## T03 — Normalize live USGS evidence

**Description:** Fetch the official USGS time-window feed, validate its GeoJSON,
and normalize earthquake records with reviewed/preliminary semantics.

**Acceptance criteria:**

- [x] 24-hour, 7-day, and 30-day windows map to documented USGS feeds.
- [x] Malformed, empty, aborted, timed-out, and HTTP-error responses return
      structured source states without contaminating workspace evidence.
- [x] Normalized records retain source URL, observed/updated time, coordinates,
      magnitude, status, and limitation.

**Verification:**

- [x] USGS adapter tests pass against minimal captured fixtures.
- [x] A live development request returns a valid ready state (164 records on
      2026-08-29).

**Dependencies:** T02
**Files likely touched:** `app/sources/core/result.ts`,
`app/sources/usgs/schema.ts`, `app/sources/usgs/client.ts`,
`tests/sources/usgs.test.ts`, `tests/fixtures/usgs.json`
**Estimated scope:** Medium (5 files)

## T04 — Build the accessible ArcGIS shell

**Description:** Load ArcGIS 5.1 map components in the browser, provide a no-key
OpenStreetMap basemap, and synchronize a geodesic selection circle with domain
state and non-map controls.

**Acceptance criteria:**

- [x] ArcGIS never executes during server rendering and cleans up on unmount.
- [x] A person can pan, zoom, enter coordinates/radius, and revise the selection.
- [x] Attribution, loading/error fallback, keyboard controls, and textual
      investigation state remain available without the map canvas.

**Verification:**

- [x] Render/source test passes without DOM-global errors.
- [x] Browser check confirms ArcGIS 5.1 map load, OSM attribution, geodesic
      selection, and labeled keyboard-accessible area controls.

**Dependencies:** T02
**Files likely touched:** `app/components/map/ArcgisMap.tsx`,
`app/components/map/AreaControls.tsx`, `app/domain/map/adapter.ts`,
`app/globals.css`, `tests/browser/map.test.ts`
**Estimated scope:** Medium (5 files)

## T05 — Connect the live USGS vertical slice

**Description:** Display normalized USGS evidence on ArcGIS and in the textual
evidence list, with popup inspection and provenance.

**Acceptance criteria:**

- [x] Changing time or area refreshes/filter results without stale overwrites.
- [x] Selecting a map feature or list item opens the same evidence details.
- [x] At least one real event can be inspected with provenance and limitation.

**Verification:**

- [ ] Integration tests cover store → layer/list → selection synchronization.
- [x] Manual browser demo works from a fresh page load.
- [x] Deploy a working checkpoint.

**Dependencies:** T03, T04
**Files likely touched:** `app/components/map/EvidenceLayer.ts`,
`app/components/evidence/EvidenceList.tsx`,
`app/components/evidence/EvidenceDetails.tsx`, `app/page.tsx`,
`tests/browser/usgs-slice.test.ts`
**Estimated scope:** Medium (5 files)

## Checkpoint B — Real ArcGIS evidence

- [x] A human can select a real area and inspect a live USGS earthquake.
- [x] Map and textual list expose identical selection and provenance.
- [x] Public checkpoint URL works without application credentials.

## T06 — Add NASA EONET evidence

**Description:** Normalize EONET v3 GeoJSON events and accurately communicate
that their aggregated geometry is approximate and for general information.

**Acceptance criteria:**

- [x] Supported time/status/bbox requests follow the official v3 contract.
- [x] Point, polygon, and dated geometry are validated or safely rejected.
- [x] EONET limitation and originating source links remain visible.

**Verification:**

- [x] EONET fixture tests cover valid, empty, malformed, and aborted responses.
- [x] Browser layer/list rendering works independently from USGS.

**Dependencies:** T05
**Files likely touched:** `app/sources/eonet/schema.ts`,
`app/sources/eonet/client.ts`, `app/components/map/EonetLayer.ts`,
`tests/sources/eonet.test.ts`, `tests/fixtures/eonet.json`
**Estimated scope:** Medium (5 files)

## T07 — Add Open-Meteo/CAMS air quality

**Description:** Query current modelled PM2.5, PM10, and US AQI for the selected
coordinate with required Open-Meteo and CAMS attribution.

**Acceptance criteria:**

- [x] Coordinate changes abort the previous request and fetch the new location.
- [x] Values, units, model/forecast nature, update time, and attribution display.
- [x] Unsupported or unavailable values never render as zero or measured sensors.

**Verification:**

- [x] Air-quality fixture tests cover valid, missing, error, and abort states.
- [x] Browser check distinguishes modelled air quality from observed earthquakes.

**Dependencies:** T05
**Files likely touched:** `app/sources/air-quality/schema.ts`,
`app/sources/air-quality/client.ts`,
`app/components/evidence/AirQualityCard.tsx`,
`tests/sources/air-quality.test.ts`, `tests/fixtures/air-quality.json`
**Estimated scope:** Medium (5 files)

## T08 — Prove provider resilience

**Description:** Coordinate all providers with independent loading, empty,
unavailable, timeout, cancellation, and stale-request behavior.

**Acceptance criteria:**

- [x] One provider failure leaves other evidence interactive.
- [x] Empty and unavailable states use different language.
- [x] Rapid area/time changes cannot apply results from an older revision.

**Verification:**

- [ ] Integration tests simulate each provider failing alone and simultaneously.
- [ ] Browser network interception verifies abort and partial rendering.

**Dependencies:** T06, T07
**Files likely touched:** `app/sources/coordinator.ts`,
`app/components/evidence/SourceStatus.tsx`, `app/domain/workspace.ts`,
`tests/integration/provider-resilience.test.ts`
**Estimated scope:** Medium (4 files)

## Checkpoint C — Complete live evidence

- [x] USGS, NASA EONET, and Open-Meteo/CAMS operate together.
- [x] Each provider can fail without a misleading blank or global failure.
- [x] Evidence types and limitations remain visible at mobile and desktop widths.

## T09 — Register WebMCP discovery and read tools

**Description:** Feature-detect WebMCP, register stable semantic tool definitions,
and expose workspace/source/query/inspection reads with structured envelopes.

**Acceptance criteria:**

- [x] Tools register once, clean up correctly, and degrade safely without WebMCP.
- [x] Inputs are validated during execution and errors use one result envelope.
- [x] Read results reflect the current human-selected workspace revision.

**Verification:**

- [x] Contract tests validate names, descriptions, schemas, results, and cleanup.
- [ ] Supported browser discovers and invokes all read tools.

**Dependencies:** T08
**Files likely touched:** `app/webmcp/types.ts`, `app/webmcp/tools.ts`,
`app/webmcp/register.ts`, `app/webmcp/useWebMcp.ts`,
`tests/webmcp/tools.test.ts`
**Estimated scope:** Medium (5 files)

## T10 — Add visible WebMCP mutations and undo

**Description:** Connect layer visibility, time, area, lens-draft, and undo tools
to the same reversible domain operations used by humans.

**Acceptance criteria:**

- [x] Every agent mutation visibly updates map/list/controls and activity history.
- [x] Mutations report revision and reversibility.
- [x] `undo_last_agent_change` restores exact prior state without undoing a newer
      human correction.

**Verification:**

- [ ] Contract/integration tests cover valid, invalid, stale, and undo calls.
- [ ] Browser demo shows an agent change, human correction, and agent adaptation.

**Dependencies:** T09
**Files likely touched:** `app/webmcp/tools.ts`, `app/domain/workspace.ts`,
`app/components/review/ActivityLog.tsx`, `app/page.tsx`,
`tests/webmcp/mutations.test.ts`
**Estimated scope:** Medium (5 files)

## T11 — Add coverage analysis and situation-lens review

**Description:** Explain source availability and evidence gaps, then compose a
provenance-rich draft that a person can revise but not publish.

**Acceptance criteria:**

- [x] Coverage analysis distinguishes ready, empty, unavailable, stale, and modelled.
- [x] Draft contains area, window, summary, gaps, citations, creation time, and
      immutable draft status.
- [x] Human edits create a new revision and no outbound side effect exists.

**Verification:**

- [x] Review-domain tests cover missing providers, citation retention, and edits.
- [ ] Exact eight-step collaboration demo succeeds from a fresh session.

**Dependencies:** T10
**Files likely touched:** `app/domain/review/coverage.ts`,
`app/domain/review/lens.ts`, `app/components/review/LensDraft.tsx`,
`app/webmcp/tools.ts`, `tests/review/lens.test.ts`
**Estimated scope:** Medium (5 files)

## Checkpoint D — WebMCP proof

- [ ] Human selection influences agent results.
- [ ] Agent operations visibly change the same map and remain reversible.
- [ ] Human correction changes the next analysis.
- [ ] The situation lens remains a draft with explicit uncertainty.

## T12 — Harden accessibility, security, performance, and browser behavior

**Description:** Apply the remaining review skills and resolve every blocking
constraint against the integrated release candidate.

**Acceptance criteria:**

- [ ] Zero critical/serious axe findings and keyboard-only core flow succeeds.
- [x] No secrets/high dependency vulnerabilities or unsafe external URLs.
- [x] LCP/CLS are measured; blocking performance regressions are resolved and
      unavoidable ArcGIS bundle cost is documented.

**Verification:**

- [x] `npm run check:task`
- [x] `npm run check:a11y -- <preview-url>`
- [x] `npm run check:performance -- <preview-url>`
- [x] Browser console/network/responsive checks pass.

**Dependencies:** T11
**Files likely touched:** `app/globals.css`, `app/layout.tsx`, `app/page.tsx`,
`README.md`, `CONSTRAINTS.md`
**Estimated scope:** Medium (5 files)

## T13 — Publish and verify the release candidate

**Description:** Deploy a public judge-accessible build, document setup and
architecture, and preserve rollback information.

**Acceptance criteria:**

- [x] URL works from a fresh unsigned-in supported browser.
- [ ] Repository is public with MIT license, setup, tool table, attribution,
      limitations, architecture, screenshots, and test instructions.
- [ ] Release tag and previous deployment provide reproducible rollback points.

**Verification:**

- [x] Fresh clone installs and passes release checks.
- [ ] Every provider failure simulation passes against the public candidate.
- [ ] Exact demo succeeds twice.

## T14 — Add worldwide agent place resolution

**Description:** Resolve natural-language places through ArcGIS World Geocoding
and expose a reversible `focus_place` WebMCP mutation that refreshes the shared
investigation workspace.

**Acceptance criteria:**

- [ ] “CDMX” resolves to a validated Mexico City WGS84 center and moves the map.
- [ ] Empty, malformed, unavailable, low-confidence, and ambiguous results fail visibly without changing the area.
- [ ] A successful change refreshes environmental evidence and appears in the collaboration trail.
- [ ] The embedded assistant uses `focus_place` instead of emitting incomplete coordinates.

**Verification:**

- [ ] Geocoding adapter fixtures and WebMCP contract tests pass.
- [ ] Public browser demo moves from Monterrey to CDMX and loads a new CAMS estimate.

**Dependencies:** T10, T12
**Files likely touched:** `app/sources/geocoding.ts`, `app/webmcp/tools.ts`,
`app/webmcp/types.ts`, `app/chat/contract.ts`, `app/page.tsx`, focused tests
**Estimated scope:** Medium

**Dependencies:** T12
**Files likely touched:** `README.md`, `CHANGELOG.md`,
`docs/submission/IMPLEMENTATION.md`, `.openai/hosting.json`
**Estimated scope:** Medium (4 files)

## T15 — Add NASA VIIRS thermal-hotspot evidence

**Description:** Add the public NASA LANCE/FIRMS VIIRS 375 m near-real-time
thermal-detection feed through its ArcGIS Living Atlas FeatureServer. Use the
same evidence records, source states, map selection, layer visibility, and
WebMCP operations as the rest of Earth Lens.

**Acceptance criteria:**

- [ ] The adapter uses a fixed public GET endpoint, selected center/radius,
      cacheable age filters, explicit fields, timeouts, cancellation, and a
      200-record cap.
- [ ] Every record retains source, acquisition time, coordinates, confidence,
      satellite, FRP, day/night, pixel dimensions, version, and an honest
      thermal-hotspot limitation.
- [ ] Human layer controls and existing WebMCP tools expose the same visible,
      inspectable records; no new WebMCP tool is introduced.
- [ ] Loading, empty, malformed, unavailable, and 30-day/feed-window limitations
      are visible and never presented as an all-clear.
- [ ] The map, text list, evidence panel, source list, and situation-lens draft
      all include the new provider without weakening human review boundaries.

**Verification:**

- [ ] Adapter URL/normalization/failure tests pass from fixtures.
- [ ] Domain and WebMCP contract tests include `nasa-firms` and
      `thermal-hotspots`.
- [ ] Browser verification shows the same record selected from the list, map,
      embedded assistant, and WebMCP inspection path.
- [ ] `npm run check:task` passes.

**Dependencies:** T08, T10, T12
**Files likely touched:** `app/sources/nasa-firms.ts`, `app/domain/types.ts`,
`app/domain/workspace.ts`, `app/webmcp/types.ts`, `app/webmcp/tools.ts`,
`app/chat/contract.ts`, `app/chat/server.ts`, `app/components/ArcgisInvestigationMap.tsx`,
`app/page.tsx`, focused tests, `README.md`, and submission implementation notes
**Estimated scope:** Medium

## T14 — Record, audit, and submit

**Description:** Produce the concise public demo and complete every Devpost field
before the internal deadline.

**Acceptance criteria:**

- [ ] Public YouTube video is audible, under three minutes, and shows human-agent
      collaboration rather than a narrated mock.
- [ ] Submission copy directly answers WebMCP fit, UX improvement, new joint
      capability, implementation, and all four judging criteria.
- [ ] Live URL, repository, video, license, credentials field, and required text
      pass a final link/content audit before submission.

**Verification:**

- [ ] Watch the public video once at normal speed with captions off.
- [ ] Open every submitted URL in a fresh browser.
- [ ] Save submission confirmation and release identifiers.

**Dependencies:** T13
**Files likely touched:** `docs/submission/DEMO_SCRIPT.md`,
`docs/submission/SUBMISSION_COPY.md`, `docs/submission/FINAL_AUDIT.md`
**Estimated scope:** Medium (3 files)

## Checkpoint E — Submitted

- [ ] All submission requirements are confirmed before 10:00 a.m. PT.
- [ ] Issue #527 case-study publishing remains separate and requires a preview
      before any public comment or private screenshot use.

## Proposed community-context extension

These tasks extend the same Earth Lens plan. The capability-map extension and
the `outdoor-conditions` specification were accepted on 2026-09-03.

## T16 — Specify the outdoor-conditions contract

**Description:** Define how official SMN municipal forecasts join existing CAMS
air quality without conflating weather temperature, NASA thermal detections, or
personal-safety advice.

**Acceptance criteria:**

- [x] Mexico-only coverage, municipality selection, units, timestamps, record
      cap, cache lifetime, and failure language are explicit.
- [x] The derived explanation identifies contributing records and gaps and never
      emits “safe,” “all clear,” or a causation claim.
- [x] No existing provider, WebMCP tool, temperature signal, or human-review
      boundary is removed.

**Verification:**

- [x] Human approves `docs/specs/SPEC-outdoor-conditions.md`.
- [x] Spec references current official SMN service documentation.

**Dependencies:** Proposed capability-map extension approval
**Files likely touched:** `docs/CAPABILITY_MAP.md`,
`docs/specs/SPEC-outdoor-conditions.md`, `tasks/plan.md`, `tasks/todo.md`
**Estimated scope:** Medium (4 files)

## T17 — Prove and cache the SMN forecast boundary

**Description:** Add a server-side boundary that downloads, decompresses,
validates, caches, and filters the official daily three-day municipality feed.

**Acceptance criteria:**

- [x] Browsers receive only the bounded municipality forecast, never the full
      nationwide compressed payload.
- [x] Cache metadata exposes source fetch time and an approximately 75-minute
      freshness policy without inventing observation ages.
- [x] Timeout, malformed gzip/JSON, missing municipality, and upstream failure
      return structured unavailable/empty states.

**Verification:**

- [x] Fixture tests fail first, then cover valid, malformed, empty, timeout, and
      cache-hit behavior.
- [x] A production-runtime spike returns current Monterrey records.

**Dependencies:** T16
**Files likely touched:** `worker/index.ts`, `app/sources/smn.ts`,
`tests/sources/smn.test.ts`, `tests/fixtures/smn-daily.json`
**Estimated scope:** Medium (4 files)

## T18 — Add typed SMN evidence to the shared workspace

**Description:** Extend the existing provider and evidence contracts so SMN
daily forecasts participate in source state, area changes, provenance, and
stale-request protection.

**Acceptance criteria:**

- [x] Records retain municipality identifiers, coordinates, forecast time,
      minimum/maximum temperature, rain, wind/gust, sky, source URL, and limitation.
- [x] Area changes cannot apply an older response, and non-Mexico areas show
      unsupported coverage without disabling global providers.
- [x] NASA thermal-hotspot records remain unchanged and separately labelled.

**Verification:**

- [x] Domain/source tests cover valid transitions and mixed-provider results.
- [x] `npm run check:fast` passes in the clean release copy.

**Dependencies:** T17
**Files likely touched:** `app/domain/types.ts`, `app/domain/workspace.ts`,
`app/domain/validation.ts`, `tests/domain/workspace.test.ts`
**Estimated scope:** Medium (4 files)

## T19 — Build the Outdoor conditions experience

**Description:** Present friendly outdoor-planning context backed by separately
inspectable air-quality and weather records.

**Acceptance criteria:**

- [x] The card shows AQI, daily temperature range, rain chance, gusts, sky,
      relevant timestamps, provenance, and an honest missing-data state.
- [x] Copy explains “what this may mean for plans” without a safety verdict and
      does not equate a thermal hotspot with ambient temperature.
- [x] The card is keyboard accessible, responsive, and has a textual fallback.

**Verification:**

- [x] Focused rendering/domain tests cover complete, partial, and unavailable data.
- [x] Browser check passes at desktop and mobile widths.

**Dependencies:** T18
**Files likely touched:** `app/domain/outdoor-conditions.ts`,
`app/components/OutdoorConditionsCard.tsx`, `app/page.tsx`,
`tests/domain/outdoor-conditions.test.ts`
**Estimated scope:** Medium (4 files)

## T20 — Ground agent answers in the same outdoor evidence

**Description:** Include SMN records and derived planning context in existing
WebMCP queries and embedded-assistant input while keeping visible agent actions.

**Acceptance criteria:**

- [x] Existing WebMCP source/query/inspection tools expose SMN evidence with no
      new tool and no tool-count drift.
- [x] An outdoor question returns data for the current map area, cites both
      contributing sources when ready, and states gaps when either is missing.
- [x] Source visibility and area changes alter the next answer through shared
      domain state, not UI scraping or a chat-only request.

**Verification:**

- [x] WebMCP and chat contract tests cover full, air-only, weather-only, and no-data cases.
- [x] Fresh browser demo shows the map, card, and WebMCP result agree.

**Dependencies:** T19
**Files likely touched:** `app/chat/contract.ts`, `app/chat/server.ts`,
`app/webmcp/tools.ts`, `tests/domain/chat.test.ts`,
`tests/webmcp/tools.test.ts`
**Estimated scope:** Medium (5 files)

## T21 — Verify, document, and deploy the outdoor slice

**Description:** Complete the quality gates and update public documentation for
the judge-visible SMN/CAMS collaboration story.

**Acceptance criteria:**

- [ ] Public source table, limitations, implementation notes, and demo wording
      match the shipped providers and unchanged 11-tool surface.
- [ ] The live app works without sign-in and exposes no credential or nationwide
      raw-feed payload to the browser.
- [ ] The previous deployment remains available as rollback evidence.

**Verification:**

- [ ] `npm run check:task`
- [ ] Accessibility, performance, console, network, and fresh-session browser checks pass.

**Dependencies:** T20
**Files likely touched:** `README.md`, `CHANGELOG.md`,
`docs/submission/IMPLEMENTATION.md`, `docs/submission/DEMO_SCRIPT.md`
**Estimated scope:** Medium (4 files)

## Checkpoint F — Outdoor conditions shipped

- [ ] Monterrey shows current SMN weather and CAMS air-quality evidence together.
- [ ] A non-Mexico place clearly shows SMN coverage is unsupported while global
      evidence remains usable.
- [ ] Human UI and agent answers change from the same area/source state.
- [ ] Temperature and NASA thermal hotspots are both retained and never conflated.

## T22 — Plan INEGI DENUE registered-place context

**Description:** After Checkpoint F, specify a server-side, token-protected DENUE
slice for nearby clinics and selected registered establishments within the
official five-kilometre query limit.

**Acceptance criteria:**

- [ ] Only necessary public establishment fields are returned; token and
      unnecessary contact data never reach the browser.
- [ ] UI says “registered establishment,” not open, shelter, polluter, or cause.
- [ ] Hotspot proximity is presented as context only.

**Verification:**

- [ ] Separate capability spec and threat review are approved before code.

**Dependencies:** Checkpoint F
**Files likely touched:** Future spec only
**Estimated scope:** Small

## T23 — Plan selected CENAPRED/CONAGUA risk context

**Description:** After Checkpoint F, verify two or three official ArcGIS layers
for Nuevo León and specify only those with queryable coverage, dates, and usable
provenance.

**Acceptance criteria:**

- [ ] Every selected layer is verified against the official service at build time.
- [ ] Static susceptibility/context is never labelled a live alert or prediction.
- [ ] HTTP/CORS limitations are handled by the existing server boundary.

**Verification:**

- [ ] Layer inventory and sample Nuevo León queries are reviewed before code.

**Dependencies:** Checkpoint F
**Files likely touched:** Future research note and spec only
**Estimated scope:** Small
