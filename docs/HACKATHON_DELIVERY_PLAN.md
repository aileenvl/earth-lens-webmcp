# Earth Lens — WebMCP Hackathon Delivery Plan

**Deadline:** September 3, 2026 at 1:00 p.m. PT
**Internal target:** September 3 at 10:00 a.m. PT
**Critical path:** ArcGIS app → live sources → WebMCP proof → public repository
and deployment → demo video → submission

## Definition of done

Earth Lens is ready only when:

1. A person can navigate the ArcGIS map and select a real geographic region.
2. USGS, NASA EONET, and Open-Meteo/CAMS load with status, timestamps,
   attribution, empty states, and failures.
3. ChatGPT's in-app browser discovers and executes the WebMCP tools.
4. Human actions and agent tool calls modify the same visible map state.
5. Every result retains provenance and limitations.
6. The collaboration demo works from a fresh browser session.
7. The live URL and source repository are public.
8. The repository has an OSI-approved license and reproducible setup.
9. The public demo video is under three minutes and includes audio.
10. All Devpost links and required fields pass a final audit.

## August 29 — Baseline, skills, and specification

### Preserve the before state

- Preserve the mocked deployment as the honest before.
- Record its incomplete controls and mocked evidence.
- Document the unshipped MapLibre deviation.
- Restore ArcGIS as the accepted architecture.

### Install Agent Skills

- Install Addy Osmani's complete `agent-skills` Codex plugin.
- Verify skill discovery and capture setup/first-run footage.
- Use the whole plugin so shared repository references remain available.

### Run the specification gate

Invoke `using-agent-skills`, `spec-driven-development`,
`constraint-driven-development`, `source-driven-development`, and
`planning-and-task-breakdown`.

Produce the PRD, non-goals, ArcGIS decision, live-source contracts, WebMCP
contract, safety constraints, quality targets, and atomic tasks.

**Exit:** no architecture or product-scope decision remains implicit.

## August 30 — Live ArcGIS evidence

### ArcGIS vertical slice

- Remove the unshipped MapLibre dependency and component.
- Integrate ArcGIS Maps SDK for JavaScript.
- Use a no-key OpenStreetMap-compatible basemap initially.
- Add pan, zoom, map selection, radius geometry, popup, and provenance UI.
- Add live USGS earthquake data.
- Deploy a working checkpoint.

**Exit:** a person can select a real area and inspect a real earthquake.

### Complete live sources

- Add NASA EONET natural events.
- Add Open-Meteo/CAMS coordinate-based air quality.
- Normalize sources into one typed evidence record.
- Add time and distance queries.
- Handle loading, empty, error, timeout, cancellation, and partial failure.
- Distinguish observed, modelled, preliminary, and aggregated data.

**Exit:** one provider can fail without disabling the investigation.

## August 31 — WebMCP collaboration

### Target tool surface

1. `get_workspace_state`
2. `list_authoritative_sources`
3. `set_layer_visibility`
4. `set_time_window`
5. `set_geographic_area`
6. `query_selected_area`
7. `inspect_observation`
8. `analyze_evidence_coverage`
9. `create_situation_lens_draft`
10. `undo_last_agent_change`
11. `focus_place`

Inputs use latitude, longitude, radius, IDs, and time—not pixels. Mutations must
visibly change the map and remain reversible. Results must include source,
timestamp, coordinates, evidence type, and limitation.

### Required demo

1. Human selects a region.
2. Agent discovers tools and sources.
3. Agent adds or filters live evidence.
4. Agent queries the human-selected region.
5. Human revises geometry or removes a layer.
6. Agent adapts to the new shared state.
7. Agent surfaces missing or provisional evidence.
8. Agent prepares—but does not publish—a situation lens.

**Exit:** the result cannot be reproduced by a detached chatbot returning only
prose.

### Office-hours checkpoint

Prepare one concise implementation question. Incorporate guidance only when it
reduces submission risk.

## September 1 — Quality and public repository

Invoke TDD, browser testing, debugging, frontend engineering, accessibility,
security, performance, simplification, and code-review skills.

Verify normalization fixtures, tool schemas, keyboard/focus behavior, non-map
alternatives, URL/input safety, CORS failures, responsive layout, bundle cost,
console output, and network behavior.

Publish the repository with:

- Visible OSI license
- Setup and test instructions
- Architecture and data-flow diagrams
- WebMCP tool table
- Source attribution and limitations
- Screenshots and Agent Skills evidence

**Exit:** no unresolved P0/P1 findings; a reviewer can clone and verify it.

## September 2 — Release and submission assets

### Release candidate

- Deploy a public judge-accessible version.
- Test from a fresh unsigned-in browser.
- Simulate each provider failing.
- Run the demo twice.
- Confirm metadata, attribution, and source links.
- Preserve a rollback version.

### Video outline

- 0:00–0:20 — problem
- 0:20–0:45 — human selects a place
- 0:45–1:35 — WebMCP calls visibly update ArcGIS
- 1:35–2:05 — human correction and agent adaptation
- 2:05–2:30 — uncertainty and provenance
- 2:30–2:50 — implementation
- 2:50–3:00 — outcome

### Submission copy

Answer why WebMCP is essential, what becomes easier, what the human and agent
can now do together, how the tools were implemented, and how the project meets
all four judging criteria.

## September 3 — Rehearse and submit

- Clone the public repository from scratch.
- Test the deployment in a fresh supported browser.
- Execute the exact prompts.
- Confirm the video is public, audible, and under three minutes.
- Verify all required URLs and fields.
- Submit before 10:00 a.m. PT.

## Non-goals

- Disaster prediction or evacuation advice
- Crowdsourced emergency reports
- Donations or volunteer transactions
- A complete emergency-management platform
- An embedded chatbot that substitutes for WebMCP
- Premium ArcGIS features that add credential risk without demo value

## External decisions

- Public GitHub owner and repository name
- License choice (MIT recommended)
- Public Sites access
- Optional ArcGIS key
- YouTube channel for the demo
