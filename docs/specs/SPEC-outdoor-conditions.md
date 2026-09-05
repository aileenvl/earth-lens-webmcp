# Spec: `outdoor-conditions`

**Status:** Accepted on 2026-09-03
**Conventions:** `SPEC-CONVENTIONS.md`

## Objective

Help a person understand what it may be like to spend time outside in the
selected area by presenting official Mexican weather forecasts beside existing
modelled air-quality evidence. The human and agent must read and change the same
Earth Lens workspace; the result is planning context, not a safety verdict.

Temperature is never removed or collapsed into another signal. SMN ambient
weather, Open-Meteo/CAMS air quality, and NASA VIIRS thermal hotspots remain
separate evidence types with separate timestamps and limitations.

## Tech stack

- Node.js 22.13 or newer and TypeScript 5.9 in strict mode
- React 19.2 with Vinext 1.0 beta and the existing Sites Worker runtime
- Existing `EvidenceRecord`, `SourceResult`, workspace, and WebMCP contracts
- SMN/CONAGUA `PronosticoPorMunicipiosGZ` (`method=1`)
- No new package or client credential

## Commands

```bash
npm run test:logic -- tests/sources/smn.test.ts
npm run test:domain -- tests/domain/outdoor-conditions.test.ts
npm run check:fast
npm run check:task
npm run check:a11y -- <preview-url>
npm run check:performance -- <preview-url>
```

## Project structure

```text
worker/index.ts                         fixed server fetch and shared cache boundary
app/sources/smn.ts                      response validation and normalization
app/domain/outdoor-conditions.ts        pure presentation interpretation
app/components/OutdoorConditionsCard.tsx accessible human-facing summary
app/page.tsx                            shared workspace orchestration
app/chat/                               embedded assistant context and response rules
app/webmcp/                             existing tool surface over shared state
tests/sources/                          captured boundary fixtures and adapter tests
tests/domain/                           pure interpretation tests
```

## Source and interface contract

Official documentation:

- https://smn.conagua.gob.mx/es/web-service-api
- Resource: `GET https://smn.conagua.gob.mx/tools/GUI/webservices/?method=1`

The fixed upstream URL is server-controlled and accepts no user-supplied host or
path. The server downloads and decompresses the nationwide feed, validates it,
and caches the validated payload for 4,500 seconds. The browser sends only a
validated WGS84 center and receives a bounded municipality response.

The public server response is a `SourceResult<EvidenceRecord[]>`-compatible
envelope. Ready records use:

- provider: `smn`
- evidence type: `weather-forecast`
- source URL: the official SMN service documentation
- coordinates: the municipality forecast point
- observed time: the forecast-valid hour from `hloc`
- fetched time: the time Earth Lens refreshed the upstream feed
- attributes: state/municipality ids and names, daily minimum/maximum
  temperature, precipitation amount/probability, wind speed/direction, gust
  speed, cloud cover, and sky description when valid
- limitation: municipal forecast, not a station observation, alert, or guarantee

The client response contains at most four daily records (today plus the
documented three-day outlook) for the nearest supported municipality. The
server rejects invalid coordinates,
non-GET requests, malformed gzip/JSON, non-finite measurements, invalid dates,
and unbounded provider records with structured errors.

## Code style

External fields are parsed before constructing domain records. Optional invalid
measurements are omitted; required identity, coordinates, and forecast time
fail the record.

```ts
type OutdoorConditions = {
  status: "ready" | "partial" | "unavailable";
  headline: string;
  facts: readonly string[];
  gaps: readonly string[];
  evidenceIds: readonly EvidenceId[];
};
```

The derived interpretation is a pure function. It never fetches, mutates the
workspace, or hides the measurements used to produce its copy.

## UI behavior

The Outdoor conditions card appears with the evidence panel and prioritizes:

1. a concise planning headline;
2. current AQI category and ambient temperature;
3. daily temperature range, rain chance, gusts, sky, and likely pollutant driver
   when present;
4. the contributing source times and coverage limitations;
5. inspectable links or controls for the underlying records.

Loading, partial, unsupported, empty, and unavailable states remain readable.
Outside Mexico, the card says the official SMN municipal forecast does not
cover the selected area while leaving worldwide air quality and other sources
usable. Color is supplementary to text, controls are keyboard operable, and
status updates use the existing live-region behavior.

## Agent behavior

The existing 11 WebMCP tools remain the public tool surface. SMN becomes part of
workspace/source discovery, layer visibility, selected-area queries, evidence
inspection, coverage analysis, undo, and situation-lens drafting through the
same domain operations used by the UI.

For questions about outdoor activity, the embedded assistant must:

- use the current selected area rather than a remembered place;
- include available AQI and SMN forecast facts with timestamps;
- distinguish forecast/model evidence from measurements and detections;
- state missing or unsupported coverage;
- avoid “safe,” “unsafe,” “all clear,” medical advice, emergency advice, and
  causal claims about facilities or thermal hotspots.

## Testing strategy

- Source tests: URL is fixed; valid, malformed, empty, timeout, abort, and cache
  response envelopes; municipality selection; four-record cap; date parsing.
- Domain tests: complete, air-only, weather-only, unsupported, and no-data
  interpretations; evidence IDs and non-verdict language.
- Contract tests: all 11 WebMCP registrations remain unchanged and return the
  same new provider state the UI uses.
- Render/browser tests: card layout, responsive overflow, keyboard access,
  source visibility, area changes, console/network state, and live Monterrey data.

Every changed behavior begins with a failing focused test. `npm run check:task`
and the release browser checks remain blocking.

## Boundaries

### Always

- Preserve source, forecast-valid time, fetch time, coordinates, units, evidence
  type, Mexico-only coverage, and limitation.
- Validate external response fields and bound work before rendering or prompting.
- Keep SMN weather, CAMS air quality, and VIIRS thermal detections distinct.
- Treat empty or failed data as a coverage gap.

### Ask first

- Add another provider, dependency, credential, persistent store, new WebMCP
  tool, or a rule presented as an official health/safety threshold.

### Never

- Scrape SIMA/SINAICA pages, expose the nationwide SMN payload to the browser,
  accept an upstream URL from user input, or include secrets.
- Present forecast data as an observation, alert, guarantee, or personal safety
  decision.
- Infer company activity, emissions, fracking, fire, responsibility, or cause
  from temperature, a thermal hotspot, or proximity.
- Add publish, send, donate, or outbound human-action capabilities.

## Success criteria

1. Monterrey displays current/near-term official SMN temperature and weather
   beside current CAMS AQI with distinct provenance and limitations.
2. A natural-language outdoor question returns a useful answer grounded in the
   selected map state and visibly agrees with the card.
3. Area and layer changes alter both the UI and the agent’s next answer through
   shared state.
4. A non-Mexico area shows explicit SMN coverage limits without breaking global
   sources.
5. The WebMCP tool count remains 11 and registration/cleanup behavior is unchanged.
6. Automated checks and fresh-browser verification pass before deployment.

## Open questions

None block this slice. Facility and hazard-context providers remain separate,
later specifications.
