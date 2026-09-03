# Earth Lens

Earth Lens is a WebMCP-powered environmental investigation map where a person
and a browser agent work on the same visible evidence workspace. The person
provides local context and stays in control; the agent can query structured
evidence, change the area or time window, explain coverage gaps, and prepare a
fully cited draft without guessing how to click the interface.

- **Live app:** https://earth-lens-webmcp.aileenvl375305.chatgpt.site/
- **Safety:** investigation aid only—not an emergency alert, forecast, risk
  score, evacuation service, or substitute for official guidance.
- **Status:** release candidate for the OpenAI WebMCP Challenge.

## Why WebMCP

Environmental maps are visually rich but difficult for agents to use reliably.
Earth Lens exposes semantic operations over the same typed workspace that the
human sees. An agent does not infer coordinates from pixels or manipulate
fragile controls. Human corrections immediately become the context for the
next tool call, and agent changes are visible, attributed, revisioned, and
reversible.

This enables a collaboration loop that a chat overlay alone cannot provide:

1. A person selects a place and time window on the ArcGIS map.
2. The agent queries only that selected area and inspects source provenance.
3. The agent may adjust the shared map; the person sees the change and can
   correct it.
4. The next analysis uses the corrected state.
5. The agent creates a cited situation-lens **draft** for human review. Nothing
   is published or sent.

## Live evidence

| Signal | Source | Treatment |
| --- | --- | --- |
| Earthquakes | [USGS GeoJSON feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | Observed events; status and source timestamps retained |
| Natural events | [NASA EONET v3](https://eonet.gsfc.nasa.gov/docs/v3) | Aggregated event geometry; approximate and for general information |
| Air quality | [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) using CAMS | Modelled forecast values, never presented as local sensor measurements |
| Thermal hotspots | [NASA LANCE/FIRMS VIIRS via ArcGIS Living Atlas](https://www.arcgis.com/home/item.html?id=dece90af1a0242dcbf0ca36d30276aa3) | Near-real-time 375 m heat detections with confidence and FRP; never presented as confirmed wildfires |

The map uses ArcGIS Maps SDK for JavaScript 5.1 with an OpenStreetMap basemap.
Every evidence record retains its source URL, observation/update time, evidence
type, and limitation. Empty, unavailable, stale, loading, and modelled states
are deliberately distinct.

## WebMCP tools

Earth Lens registers these 11 tools with `document.modelContext.registerTool()`
when the browser exposes the experimental WebMCP API:

| Tool | What it lets the agent do |
| --- | --- |
| `get_workspace_state` | Read the current area, time, layers, source states, evidence, and revision |
| `list_authoritative_sources` | Inspect source attribution, freshness, evidence type, and limitations |
| `set_layer_visibility` | Show or hide one evidence layer on the shared map |
| `set_time_window` | Change the shared 24-hour, 7-day, or 30-day window |
| `set_geographic_area` | Set a validated WGS84 center and radius |
| `query_selected_area` | Query evidence intersecting the current human selection |
| `inspect_observation` | Select and inspect one evidence record by opaque ID |
| `analyze_evidence_coverage` | Explain ready, empty, unavailable, stale, and modelled coverage |
| `create_situation_lens_draft` | Compose a provenance-rich draft for human review only |
| `undo_last_agent_change` | Undo the latest safe agent mutation without overwriting a newer human correction |
| `focus_place` | Resolve a worldwide place name with ArcGIS, move the shared map, and refresh evidence |

All schemas reject additional properties. Execution revalidates inputs and
returns a consistent success/error envelope. Browsers without WebMCP retain the
complete human interface and show that agent tools are unavailable.

## Architecture

The React UI, embedded natural-language assistant, ArcGIS adapter, and WebMCP
layer all call the same framework-free domain operations. The assistant turns
plain-language requests into validated, allowlisted tool actions; the browser
agent can discover and call those same operations through WebMCP. Public-provider
adapters normalize external responses into one evidence contract. Request
cancellation and revision checks prevent stale results from overwriting newer
human choices. See
[architecture decisions](docs/ARCHITECTURE.md) and the
[implementation notes](docs/submission/IMPLEMENTATION.md).

## Run locally

Prerequisite: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
# Add your server-side OPENAI_API_KEY to .env.local
npm run dev
```

Open the printed local URL in Chrome with WebMCP enabled. The environmental
sources need no keys. The optional embedded assistant requires a server-side
OpenAI API key; the key is never sent to the browser. Questions
and the current evidence snapshot are sent to OpenAI with response storage
disabled.

## Verify

```bash
npm run check:task
npm run check:a11y -- http://localhost:3000
npm run check:performance -- http://localhost:3000
```

The release suite covers domain reversibility, source normalization and failure
states, review drafts, strict WebMCP contracts, server rendering, architecture,
secret scanning, dependency audit, accessibility, and browser performance.

## Limitations

- Public feeds can be delayed, incomplete, revised, or unavailable.
- EONET geometry is aggregated and may not describe current local impact.
- CAMS air quality is modelled and is not a nearby regulatory sensor reading.
- VIIRS hotspots indicate unusual heat within an approximately 375 m satellite
  pixel. They can be delayed, incomplete, or false positive and do not confirm
  a wildfire, perimeter, cause, or local safety condition. The feed retains
  seven days even when the workspace is set to 30 days.
- No risk score or causal conclusion is generated.
- Situation lenses remain drafts. The app cannot publish, message, donate,
  volunteer, or transmit personal information.
- WebMCP requires a supported experimental browser; other browsers remain fully
  usable by a person.

## Agent Skills workflow

The project also documents a real use of Addy Osmani's open-source
[`agent-skills`](https://github.com/addyosmani/agent-skills) workflow for
specification, constraints, incremental implementation, testing, review, and
launch preparation. This is an independent community case study proposed for
[issue #527](https://github.com/addyosmani/agent-skills/issues/527), not a
sponsorship, endorsement, or formal partnership. See the
[case-study plan](docs/AGENT_SKILLS_CASE_STUDY.md).

## License

[MIT](LICENSE) © 2026 Aileen Villanueva.
