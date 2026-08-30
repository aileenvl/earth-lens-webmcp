# Spec: `collaboration-review`

**Status:** Accepted
**Conventions:** `SPEC-CONVENTIONS.md`

## Objective

Make human-agent collaboration legible: show who changed what, allow correction
and undo, expose evidence gaps, and keep the final situation lens as a draft.

## Commands and structure

UI belongs in `app/components/review/`; pure analysis and lens composition belong
in `app/domain/review/`; tests belong in `tests/review/`.

## Public contracts and style

- Activity entries contain actor, operation, timestamp, revision, and summary.
- Coverage analysis reports available, empty, unavailable, stale, and modelled
  sources without inventing confidence scores.
- Lens drafts contain area, time window, evidence summary, explicit gaps,
  citations, creation time, and `status: "draft"`.
- Human edits create a new revision; nothing is published or transmitted.

## Testing strategy

Test actor attribution, revision order, undo, provider-gap language, provenance
retention, human correction, and the absence of publish/send side effects.

## Boundaries

- Always distinguish observation, model, aggregation, and unavailable data.
- Ask before introducing AI-generated risk ranking or outbound actions.
- Never label the draft an alert, prediction, recommendation, or official report.

## Success criteria

- A judge can see the human correction change the agent’s next analysis.
- Every agent mutation is visible and reversible.
- A situation lens cannot leave draft state in the MVP.
