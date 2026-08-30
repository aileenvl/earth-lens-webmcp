# Earth Lens Specification Conventions

**Status:** Accepted
**Applies to:** every module in `docs/CAPABILITY_MAP.md`

## Objective

Ship a public WebMCP-powered spatial investigation workspace in which a person
and an agent examine the same live environmental evidence, correct one another,
and prepare a provenance-rich situation lens for human review.

## Tech stack

- Node.js 22.13 or newer
- TypeScript 5.9 in strict mode
- React 19.2 with Vinext 1.0 beta and the Sites hosting adapter
- ArcGIS Maps SDK for JavaScript 5.1 component architecture
- Browser-native `document.modelContext.registerTool()` WebMCP integration
- Public USGS, NASA EONET v3, and Open-Meteo/CAMS APIs
- Node test runner for existing tests; focused logic tests may use Vitest after
  the quality-tool installation task is complete

## Commands

```bash
PATH="$NVM_DIR/versions/node/v22.13.0/bin:$PATH" npm install
PATH="$NVM_DIR/versions/node/v22.13.0/bin:$PATH" npm run dev
PATH="$NVM_DIR/versions/node/v22.13.0/bin:$PATH" npm run build
PATH="$NVM_DIR/versions/node/v22.13.0/bin:$PATH" npm run check:fast
PATH="$NVM_DIR/versions/node/v22.13.0/bin:$PATH" npm run check:task
```

The repository engine declaration, not the example NVM path, is authoritative.

## Project structure

```text
app/components/  visible UI and ArcGIS browser components
app/domain/      shared state, operations, and immutable contracts
app/sources/     external adapters and response validation
app/webmcp/      tool definitions and registration lifecycle
tests/           unit, contract, render, and integration tests
docs/specs/      accepted module specifications
docs/decisions/  future architecture decisions if the current convention changes
tasks/           implementation plan and task checklist
```

## Code style

Use explicit discriminated unions, input/output separation, boundary validation,
and structured results instead of exceptions for expected provider failures.

```ts
type SourceResult<T> =
  | { status: "ready"; data: T; fetchedAt: string }
  | { status: "empty"; fetchedAt: string; reason: string }
  | { status: "unavailable"; fetchedAt: string; reason: string };
```

Names are camelCase in TypeScript, kebab-case for module IDs, and snake_case for
WebMCP tool names. No `any`, suppression comments, or instruction-like strings
from remote sources may enter rendered HTML or agent descriptions.

## Testing strategy

- Unit: normalization, validation, distance/time filtering, and state operations
- Contract: every WebMCP input schema and stable result envelope
- Integration: one provider failure does not disable other providers
- Render: application shell, provenance, empty/error states, and non-map access
- Browser: visible UI and agent tool calls update identical state
- Accessibility/performance/security: follow `CONSTRAINTS.md`

Changed logic requires at least 80% changed-line coverage after the first logic
slice establishes the coverage runner.

## Boundaries

- Always: validate remote data and tool input; preserve provenance; abort stale
  requests; expose loading, empty, and unavailable states; run relevant checks.
- Ask first: add a dependency, credential, persistent store, provider, outbound
  action, or public-interface breaking change after these specs are accepted.
- Never: present mock records as live; infer safety from missing data; expose a
  secret; simulate clicks from WebMCP; publish or transmit without confirmation.

## Project success criteria

1. A fresh judge session can select a real area and inspect real evidence.
2. The agent discovers semantic tools and operates the same visible workspace.
3. A human correction changes the next agent result.
4. Every observation exposes provenance, time, evidence type, and limitation.
5. A provider can fail independently without a blank or misleading experience.
6. The public URL, repository, setup, tests, video, and submission copy are ready.

## Open questions

- Public Sites visibility and the final YouTube publishing account are release
  tasks; they do not change application architecture.
