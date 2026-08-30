# Earth Lens Constraints

Last reviewed: 2026-08-29 by Aileen Villanueva

These constraints are part of the submission contract. Fix the implementation
when a check fails; do not weaken this file to make a change pass.

## Floor — always blocking

- No new suppression comments such as `@ts-ignore`, `@ts-nocheck`, or `eslint-disable`.
- No unimplemented stubs, empty catches, skipped tests, deleted tests, or removed assertions.
- No credentials, private messages, personal information, or unredacted secrets in source or logs.
- No illustrative environmental observation may be presented as live evidence.
- No agent operation may publish, send, donate, volunteer, or transmit personal information without an explicit future specification and human confirmation.
- Every environmental result retains source, observation time, evidence type, coordinates, and known limitation.
- This file cannot be weakened in the same change that needs the weaker rule.

## Enforced constraints

| Dimension | Rule and rationale | Checked by | Runs at | Failure |
|---|---|---|---|---|
| Runtime | Node.js 22.13 or newer, matching `package.json` | `node --version` and package engine check | setup, CI | Block |
| Types | Zero TypeScript errors | `npm run typecheck` | every task, CI | Block |
| Lint | Zero ESLint errors | `npm run lint` | every task, CI | Block |
| Floor | No cheap-road-to-green changes listed above | `npm run check:floor` since the last save point; `npm run check:floor:review` for the branch | every task, review, CI | Block |
| Tests | All focused and integration tests pass | `npm test` | task end, CI | Block |
| Changed-code coverage | At least 80%; high enough to require meaningful tests while allowing configuration-only changes | coverage report intersected with the task diff | task end, CI | Warn until the first logic slice, then block |
| Secrets | No detected secrets; results must be redacted | `npm run check:secrets`; full-history scan in release CI | task end, CI | Block |
| Dependencies | No high or critical known vulnerabilities | `npm audit --audit-level=high` | task end, CI | Block |
| Accessibility | Zero critical or serious axe findings against WCAG A/AA | `npm run check:a11y -- <URL>` | preview, release | Block |
| Architecture | No dependency-rule violations | `npm run check:architecture` | task end, CI | Warn until module boundaries exist, then block |
| Performance | LCP at most 2.5 s and CLS at most 0.1, matching Core Web Vitals “good” thresholds | `npm run check:performance -- <URL>` using Chrome PerformanceObserver | preview, release | Warn until release candidate |

## Time budgets

| Stage | Budget | Response when exceeded |
|---|---:|---|
| Fast edit checks | 10 seconds | Move nonessential checks to task end; do not remove them |
| Task-completion checks | 90 seconds | Report the measured bottleneck and optimize or re-scope the check |
| Full release/CI checks | 5 minutes | Report the measured bottleneck before changing the gate |

## Measured, not yet enforced

| Metric | Baseline | Direction |
|---|---:|---|
| Project coverage | Measure after obsolete starter test is replaced | Must not fall by more than 0.5% |
| Main JavaScript bundle | Measure after ArcGIS vertical slice | Must not grow without a documented reason |
| LCP | Measure on first public ArcGIS preview | Move toward or remain at 2.5 s or less |
| CLS | Measure on first public ArcGIS preview | Move toward or remain at 0.1 or less |

## Accessibility and non-map access

- Map actions also require keyboard-operable controls and a textual evidence list.
- Focus must remain visible; status changes must be announced without stealing focus.
- Color cannot be the only representation of evidence type or source status.
- Reduced-motion preferences must be respected.

## Data and safety boundaries

- Treat remote API responses and WebMCP inputs as untrusted data and validate them at their boundary.
- A failed or empty provider means “data unavailable,” never “no hazard.”
- Earth Lens is not an official alert, prediction, evacuation, or personal-safety service.
- Client code contains no private API credentials. A source requiring secrets needs an explicit architecture review.
- Only public source URLs may appear in evidence provenance.

## Exceptions

No exceptions are approved. Any future exception needs an ID, rule, path, reason,
owner, and expiry within 90 days, and must be reviewed separately from the
feature that needs it.
