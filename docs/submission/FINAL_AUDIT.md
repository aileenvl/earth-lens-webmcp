# Final submission audit

## Complete

- [x] Production release candidate deployed.
- [x] Site access set to public for judges.
- [x] Live USGS, NASA EONET, and Open-Meteo/CAMS data verified.
- [x] ArcGIS map and accessible textual controls verified.
- [x] Ten WebMCP tools implemented with strict schemas and structured results.
- [x] MIT license, setup, architecture, attribution, limitations, and tests documented.
- [x] Full release checks, production accessibility, performance, and console checks passed.
- [x] Submission copy and under-three-minute demo script prepared.

## Must complete before Devpost submission

- [ ] In Chrome with WebMCP enabled, discover and invoke every read tool.
- [ ] Run the exact demo twice from fresh sessions; verify mutation, correction,
      adaptation, undo behavior, and draft creation.
- [ ] Test the core flow with keyboard only and at mobile and desktop widths.
- [ ] Clone the public repository into a clean directory, install, and run the
      release suite.
- [ ] Create and push the release tag after the final verified code commit.
- [ ] Record the demo with audio, upload it publicly to YouTube, and watch it
      once at normal speed with captions off.
- [ ] Add the YouTube URL to `SUBMISSION_COPY.md` and Devpost.
- [ ] Open the live app, repository, license, and video in a fresh signed-out
      browser.
- [ ] Submit Devpost and save the confirmation.

## Known non-blocking finding

`npm audit` reports four moderate vulnerabilities in the development-only
Drizzle tooling chain. No high-severity finding exists; the automated forced fix
would make a breaking downgrade and is not applied to the release candidate.

## Separate community follow-up

The Agent Skills issue #527 case study is not part of the Devpost submission.
Preview any public comment with Aileen before posting, and do not publish private
conversation screenshots or imply sponsorship, endorsement, or partnership.
