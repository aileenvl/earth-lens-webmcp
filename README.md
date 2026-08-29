# Earth Lens

Earth Lens is a WebMCP-powered spatial investigation workspace where a person
and their browser agent examine live environmental evidence together.

The human supplies geographic context by selecting an area. The agent uses
structured WebMCP tools to operate the same visible map, combine public sources,
inspect observations, surface uncertainty, and prepare a reproducible situation
lens for human review.

## Project status

- The currently deployed URL is the original interaction prototype and uses
  illustrative observations.
- The real ArcGIS implementation is the active release target.
- Initial live sources: USGS earthquakes, NASA EONET natural events, and
  Open-Meteo/CAMS air quality.
- The project is being prepared for the OpenAI WebMCP Challenge deadline on
  September 3, 2026 at 1:00 p.m. PT.

## Project documents

- [Hackathon delivery plan](docs/HACKATHON_DELIVERY_PLAN.md)
- [Agent Skills case study](docs/AGENT_SKILLS_CASE_STUDY.md)
- [Architecture decisions](docs/ARCHITECTURE.md)

## Local development

Prerequisite: Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm run build
```

## Submission requirements

The release is not considered submission-ready until it has:

- A public judge-accessible production URL
- A public source repository with an OSI-approved license
- Working `document.modelContext.registerTool()` integrations
- A public demo video under three minutes with audio
- Complete setup, attribution, safety, and testing documentation

## Safety boundary

Earth Lens is an investigation aid, not an official emergency-alert,
prediction, evacuation, or personal-safety service. Every observation must
retain its source, timestamp, data type, and known limitation.
