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

- [ ] ArcGIS never executes during server rendering and cleans up on unmount.
- [ ] A person can pan, zoom, enter coordinates/radius, and revise the selection.
- [ ] Attribution, loading/error fallback, keyboard controls, and textual
      investigation state remain available without the map canvas.

**Verification:**

- [ ] Render test passes without DOM-global errors.
- [ ] Browser check confirms map load and keyboard-accessible selection update.

**Dependencies:** T02
**Files likely touched:** `app/components/map/ArcgisMap.tsx`,
`app/components/map/AreaControls.tsx`, `app/domain/map/adapter.ts`,
`app/globals.css`, `tests/browser/map.test.ts`
**Estimated scope:** Medium (5 files)

## T05 — Connect the live USGS vertical slice

**Description:** Display normalized USGS evidence on ArcGIS and in the textual
evidence list, with popup inspection and provenance.

**Acceptance criteria:**

- [ ] Changing time or area refreshes/filter results without stale overwrites.
- [ ] Selecting a map feature or list item opens the same evidence details.
- [ ] At least one real event can be inspected with provenance and limitation.

**Verification:**

- [ ] Integration tests cover store → layer/list → selection synchronization.
- [ ] Manual browser demo works from a fresh page load.
- [ ] Deploy a working checkpoint.

**Dependencies:** T03, T04
**Files likely touched:** `app/components/map/EvidenceLayer.ts`,
`app/components/evidence/EvidenceList.tsx`,
`app/components/evidence/EvidenceDetails.tsx`, `app/page.tsx`,
`tests/browser/usgs-slice.test.ts`
**Estimated scope:** Medium (5 files)

## Checkpoint B — Real ArcGIS evidence

- [ ] A human can select a real area and inspect a live USGS earthquake.
- [ ] Map and textual list expose identical selection and provenance.
- [ ] Public checkpoint URL works without application credentials.

## T06 — Add NASA EONET evidence

**Description:** Normalize EONET v3 GeoJSON events and accurately communicate
that their aggregated geometry is approximate and for general information.

**Acceptance criteria:**

- [ ] Supported time/status/bbox requests follow the official v3 contract.
- [ ] Point, polygon, and dated geometry are validated or safely rejected.
- [ ] EONET limitation and originating source links remain visible.

**Verification:**

- [ ] EONET fixture tests cover valid, empty, malformed, and aborted responses.
- [ ] Browser layer/list rendering works independently from USGS.

**Dependencies:** T05
**Files likely touched:** `app/sources/eonet/schema.ts`,
`app/sources/eonet/client.ts`, `app/components/map/EonetLayer.ts`,
`tests/sources/eonet.test.ts`, `tests/fixtures/eonet.json`
**Estimated scope:** Medium (5 files)

## T07 — Add Open-Meteo/CAMS air quality

**Description:** Query current modelled PM2.5, PM10, and US AQI for the selected
coordinate with required Open-Meteo and CAMS attribution.

**Acceptance criteria:**

- [ ] Coordinate changes abort the previous request and fetch the new location.
- [ ] Values, units, model/forecast nature, update time, and attribution display.
- [ ] Unsupported or unavailable values never render as zero or measured sensors.

**Verification:**

- [ ] Air-quality fixture tests cover valid, missing, error, and abort states.
- [ ] Browser check distinguishes modelled air quality from observed earthquakes.

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

- [ ] One provider failure leaves other evidence interactive.
- [ ] Empty and unavailable states use different language.
- [ ] Rapid area/time changes cannot apply results from an older revision.

**Verification:**

- [ ] Integration tests simulate each provider failing alone and simultaneously.
- [ ] Browser network interception verifies abort and partial rendering.

**Dependencies:** T06, T07
**Files likely touched:** `app/sources/coordinator.ts`,
`app/components/evidence/SourceStatus.tsx`, `app/domain/workspace.ts`,
`tests/integration/provider-resilience.test.ts`
**Estimated scope:** Medium (4 files)

## Checkpoint C — Complete live evidence

- [ ] USGS, NASA EONET, and Open-Meteo/CAMS operate together.
- [ ] Each provider can fail without a misleading blank or global failure.
- [ ] Evidence types and limitations remain visible at mobile and desktop widths.

## T09 — Register WebMCP discovery and read tools

**Description:** Feature-detect WebMCP, register stable semantic tool definitions,
and expose workspace/source/query/inspection reads with structured envelopes.

**Acceptance criteria:**

- [ ] Tools register once, clean up correctly, and degrade safely without WebMCP.
- [ ] Inputs are validated during execution and errors use one result envelope.
- [ ] Read results reflect the current human-selected workspace revision.

**Verification:**

- [ ] Contract tests validate names, descriptions, schemas, results, and cleanup.
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

- [ ] Every agent mutation visibly updates map/list/controls and activity history.
- [ ] Mutations report revision and reversibility.
- [ ] `undo_last_agent_change` restores exact prior state without undoing a newer
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

- [ ] Coverage analysis distinguishes ready, empty, unavailable, stale, and modelled.
- [ ] Draft contains area, window, summary, gaps, citations, creation time, and
      immutable draft status.
- [ ] Human edits create a new revision and no outbound side effect exists.

**Verification:**

- [ ] Review-domain tests cover missing providers, citation retention, and edits.
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
- [ ] No secrets/high dependency vulnerabilities or unsafe external URLs.
- [ ] LCP/CLS are measured; blocking performance regressions are resolved and
      unavoidable ArcGIS bundle cost is documented.

**Verification:**

- [ ] `npm run check:task`
- [ ] `npm run check:a11y -- <preview-url>`
- [ ] `npm run check:performance -- <preview-url>`
- [ ] Browser console/network/responsive checks pass.

**Dependencies:** T11
**Files likely touched:** `app/globals.css`, `app/layout.tsx`, `app/page.tsx`,
`README.md`, `CONSTRAINTS.md`
**Estimated scope:** Medium (5 files)

## T13 — Publish and verify the release candidate

**Description:** Deploy a public judge-accessible build, document setup and
architecture, and preserve rollback information.

**Acceptance criteria:**

- [ ] URL works from a fresh unsigned-in supported browser.
- [ ] Repository is public with MIT license, setup, tool table, attribution,
      limitations, architecture, screenshots, and test instructions.
- [ ] Release tag and previous deployment provide reproducible rollback points.

**Verification:**

- [ ] Fresh clone installs and passes release checks.
- [ ] Every provider failure simulation passes against the public candidate.
- [ ] Exact demo succeeds twice.

**Dependencies:** T12
**Files likely touched:** `README.md`, `CHANGELOG.md`,
`docs/submission/IMPLEMENTATION.md`, `.openai/hosting.json`
**Estimated scope:** Medium (4 files)

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
