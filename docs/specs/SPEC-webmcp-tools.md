# Spec: `webmcp-tools`

**Status:** Accepted
**Conventions:** `SPEC-CONVENTIONS.md`

## Objective

Expose a small semantic tool surface that lets a browser agent inspect and
operate the same Earth Lens domain state a person sees.

## Commands and structure

Tool definitions, schemas, registration, and feature detection belong in
`app/webmcp/`; contract tests belong in `tests/webmcp/`.

## Tool contract

All results use `{ ok: true, data }` or `{ ok: false, error: { code, message,
details? } }`. Inputs are validated again during execution because schemas may
be stale between discovery and invocation.

1. `get_workspace_state`
2. `list_authoritative_sources`
3. `set_layer_visibility` — additive replacement for separate add/remove tools
4. `set_time_window`
5. `set_geographic_area`
6. `query_selected_area`
7. `inspect_observation`
8. `analyze_evidence_coverage`
9. `create_situation_lens_draft`
10. `undo_last_agent_change`

Coordinates are WGS84; radius is kilometres; IDs are opaque strings. Mutating
tools report the applied change, current revision, and whether it is reversible.

Official source: https://github.com/webmachinelearning/webmcp/blob/main/index.bs

## Testing strategy

Contract-test names, descriptions, JSON schemas, invalid input, stable envelopes,
registration cleanup, unsupported-browser fallback, shared-state mutations, and
undo behavior.

## Boundaries

- Always feature-detect WebMCP and register/unregister with component lifecycle.
- Ask before renaming/removing a tool or adding an irreversible tool.
- Never expose arbitrary script execution, DOM clicks, secrets, or outbound send.

## Success criteria

- ChatGPT/Chrome discovers every tool from a fresh supported session.
- Tool calls cause visible, logged state changes identical to human operations.
- The app remains fully human-usable where WebMCP is unavailable.
