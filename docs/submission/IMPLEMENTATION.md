# Earth Lens implementation

## Product boundary

Earth Lens is a shared environmental evidence workspace, not an autonomous
emergency system. The human selects the geographic context and can revise every
agent change. The agent receives semantic tools for evidence work and can only
produce a reviewable draft; there is no send or publish operation.

## Data flow

1. Area and time controls update the revisioned workspace.
2. Independent adapters request USGS, NASA EONET, and Open-Meteo/CAMS data.
3. Each adapter validates and normalizes provenance into a common evidence
   contract. Abort signals and revision checks discard stale responses.
4. ArcGIS and the textual evidence surface render the same normalized records.
5. WebMCP tools call the same domain operations as the human UI.
6. The embedded assistant maps natural language to the same allowlisted tool
   executors; structured output is validated again before any action runs.
7. Coverage analysis and lens drafting use only the current selected area.

## Natural-language interaction

Signed-in visitors can ask questions directly in the app. A bounded evidence
snapshot and short conversation history go to the OpenAI Responses API with
storage disabled. The API key remains server-side. Both request and model output
are validated, actions are restricted to the ten Earth Lens operations, and a
question does not trigger a mutation unless the person explicitly asks for one.

## WebMCP implementation

`app/webmcp/tools.ts` defines the ten public tools, strict JSON schemas, runtime
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

The Codex in-app browser used for the verification snapshot did not expose the
experimental `document.modelContext` API. Contract behavior is automated; the
submission video must additionally prove discovery and invocation in Chrome
with WebMCP enabled.
