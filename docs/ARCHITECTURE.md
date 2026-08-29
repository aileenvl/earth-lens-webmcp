# Earth Lens Architecture Decisions

## ADR-001: ArcGIS is the geospatial engine

**Status:** Accepted

Use the ArcGIS Maps SDK for JavaScript for map rendering, layers, geometry,
queries, popups, and spatial interaction. Start with an
OpenStreetMap-compatible basemap to avoid a credential dependency.

The engine must not change without an explicit architecture discussion.

## ADR-002: Live public sources precede premium integrations

Initial sources:

- USGS earthquake GeoJSON
- NASA EONET natural events
- Open-Meteo/CAMS air quality

NASA FIRMS, OpenAQ, ArcGIS Living Atlas, or premium ArcGIS basemaps may be added
only after the critical path is stable and their licensing and credentials are
documented.

## ADR-003: WebMCP operates domain state

WebMCP tools call the same typed operations as the visible application. They do
not simulate clicks or expose arbitrary JavaScript.

## ADR-004: Evidence is typed

Every record identifies whether it is observed, modelled, preliminary,
aggregated, or an official alert. Missing data is not evidence of missing risk.

## ADR-005: Human confirmation

The agent may prepare a situation lens. Publishing, messaging, donating,
volunteering, or transmitting personal information is outside the MVP.
