# Spec: `release-submission`

**Status:** Accepted
**Conventions:** `SPEC-CONVENTIONS.md`

## Objective

Deliver a reproducible, publicly accessible submission that proves WebMCP
leverage, coherent execution, credible impact, and creative ambition.

## Commands and structure

Use all shared quality commands plus preview accessibility and Lighthouse checks.
Release documentation belongs in `README.md` and `docs/`; submission artifacts
belong in `docs/submission/`; generated secrets and build output stay ignored.

## Release contract

- Public judge URL without owner-only access
- Public repository with visible MIT license and reproducible setup
- Current architecture, source attribution, safety, WebMCP tool table, and tests
- Under-three-minute public YouTube demo with audio
- Submission description answering all four requested prompts and criteria
- Tagged release and rollback deployment reference
- Separate Agent Skills case-study materials; no claim of sponsorship or formal
  partnership with Addy Osmani’s team

## Testing strategy

Clone from scratch, install with supported Node, run all checks, test a fresh
browser, simulate each provider failure, execute the exact demo twice, and audit
every public link.

## Boundaries

- Always distinguish the mocked before-state from the live release.
- Ask before publishing screenshots of private conversations or posting issue
  #527 materials.
- Never submit owner-only URLs, mock evidence, credentials, or unsupported claims.

## Success criteria

- All Devpost requirements are complete before the internal deadline.
- The exact demo succeeds twice from fresh sessions.
- No unresolved blocking constraint remains.
