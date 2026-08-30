# Spec: `workspace-core`

**Status:** Accepted
**Conventions:** `SPEC-CONVENTIONS.md`

## Objective

Define one framework-independent state and operation layer consumed by both the
visible React UI and WebMCP tools. This prevents tool calls from becoming a
second, detached application.

## Commands and structure

Use the shared commands. Implementation belongs in `app/domain/`; tests belong
in `tests/domain/`.

## Public contracts

- `InvestigationArea`: WGS84 latitude/longitude, radius in kilometres, label,
  and `updatedBy` (`human` or `agent`).
- `EvidenceRecord`: branded ID, provider, source URL, coordinates, observed time,
  fetched time, evidence type, title, attributes, and limitation.
- `SourceState`: idle, loading, ready, empty, or unavailable.
- `WorkspaceState`: area, time window, visible providers, normalized evidence,
  selected evidence, activity entries, and optional lens draft.
- Domain operations return a result and an inverse operation when reversible.

Expected failures use `{ code, message, details? }`; invalid external input is
rejected at its boundary and never partially enters state.

## Testing strategy

Test coordinate/radius limits, immutable transitions, inverse operations,
selection clearing, deterministic filtering, and structured errors.

## Boundaries

- Always keep the domain layer independent of React, ArcGIS, and WebMCP globals.
- Ask before adding persistence or changing a public field type.
- Never store provider-specific raw objects as canonical workspace state.

## Success criteria

- UI and WebMCP adapters invoke the same exported operations.
- Reversible operations restore the prior state exactly.
- No valid state can omit evidence provenance fields.
