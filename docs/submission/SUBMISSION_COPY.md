# Submission copy

## Project name

Earth Lens — investigate a place with your agent

## Short description

Earth Lens is a live ArcGIS environmental evidence map where a person selects
the local context and an agent uses WebMCP tools to investigate the same visible
workspace, explain uncertainty, make reversible changes, and prepare a cited
draft for human review.

## Why this is a strong fit for WebMCP

Maps are high-information interfaces but poor targets for agents that must infer
meaning from pixels and UI controls. Earth Lens exposes eleven semantic tools over
the same typed, revisioned state used by its human interface. The agent can read
the exact selected area, query only intersecting evidence, inspect provenance,
change map scope visibly, and undo safe changes. This is not a chat box attached
to a map: WebMCP is the collaboration contract that makes the experience
reliable.

## How it creates a better user experience

The person can ask a question in natural language without first understanding
every filter, layer, coordinate, or provider convention. The embedded assistant
uses the same allowlisted operations exposed through WebMCP, while an external
browser agent can discover them directly. The person still keeps the
visual map and final judgment. Agent operations appear in the same controls,
carry attribution and revisions, and remain reversible. Human corrections
immediately govern the agent’s next result.

## What people and agents can do together now

A person can establish local context that an agent cannot infer safely. The
agent can then combine live USGS earthquakes, NASA EONET natural events, NASA
VIIRS thermal detections, modelled Open-Meteo/CAMS air quality, and official
SMN/CONAGUA municipal weather; distinguish missing coverage from no reported
events; and turn the investigation into a provenance-rich situation lens. The
person can correct scope and review the artifact. Previously this required
manually coordinating multiple data sites or trusting an agent to guess a
complex visual interface.

## How WebMCP was implemented

Earth Lens feature-detects `document.modelContext` and registers eleven tools with
strict JSON schemas. All tools call the same framework-independent domain
operations as the React/ArcGIS UI. Inputs are validated at execution, results
use one structured envelope, provider requests are independently cancellable,
and revisions prevent stale results. Mutations report reversibility; undo never
overwrites a newer human correction. Unsupported browsers keep the full human
experience.

## Judging criteria

**WebMCP leverage:** Eleven non-trivial read, mutation, analysis, drafting, and undo
tools operate real application state. The demo proves discovery and invocation.

**Execution:** A coherent public app combines a production map, five live
signals, accessible textual controls, source provenance, graceful failure
states, 86 automated tests, and measured production quality.

**Potential impact:** Complex geospatial evidence becomes approachable to
community organizers, journalists, educators, and residents without removing
human context or overstating public data.

**Creativity and ambition:** Earth Lens treats the map as a shared instrument
for turn-by-turn human-agent investigation. Human corrections alter the next
agent analysis, and the end product is a cited draft—not autonomous action.

## Links

- Live app: https://earth-lens-webmcp.aileenvl375305.chatgpt.site/
- Repository: https://github.com/aileenvl/earth-lens-webmcp
- Demo video: **add public YouTube URL after recording**
