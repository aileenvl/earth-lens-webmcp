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

## ADR-006: Use the current ArcGIS component architecture

**Status:** Accepted

Use ArcGIS Maps SDK for JavaScript 5.1 components for the visible map shell,
loaded only in the browser. Use ArcGIS core classes for typed layers, geodesic
selection circles, and spatial queries.

ArcGIS 5.1 recommends map components and deprecates new widget-based `MapView`
UI work ahead of version 6.0 removals. This decision avoids starting the
submission on a deprecated presentation architecture while retaining direct
access to the geospatial APIs Earth Lens needs.

Official sources:

- https://developers.arcgis.com/javascript/latest/v5-1/
- https://developers.arcgis.com/javascript/latest/get-started/
- https://developers.arcgis.com/javascript/latest/references/core/geometry/Circle/
- https://developers.arcgis.com/javascript/latest/query-filter/
