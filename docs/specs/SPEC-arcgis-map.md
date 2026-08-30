# Spec: `arcgis-map`

**Status:** Accepted
**Conventions:** `SPEC-CONVENTIONS.md`

## Objective

Render the shared workspace on an accessible ArcGIS 5.1 map and let a person
select, inspect, and revise a real geographic area without requiring a key.

## Commands and structure

Use the shared commands. Browser-only map code belongs in `app/components/map/`;
map/domain adapters belong in `app/domain/map/`; browser tests belong in
`tests/browser/`.

## Public contracts and style

- Load ArcGIS map components only on the client to avoid server DOM access.
- Use an `OpenStreetMapLayer`-backed basemap with required attribution.
- Represent the area with a geodesic ArcGIS `Circle` in WGS84.
- Render evidence by stable record ID and expose selection through a typed map
  adapter, never pixel coordinates.
- Mirror map evidence in a keyboard-operable textual list.

## Testing strategy

Verify lazy loading, map readiness/error states, coordinate-to-domain events,
circle updates, evidence selection, keyboard alternative, reduced motion, and
cleanup on unmount.

## Boundaries

- Always preserve attribution and non-map access.
- Ask before using an ArcGIS API key, premium basemap, or 3D scene.
- Never make the map the only way to inspect or change the investigation.

## Success criteria

- A person can pan/zoom, set a centre and radius, and inspect one live USGS item.
- Domain changes initiated by an agent visibly update the same map.
- The page remains usable if ArcGIS fails to initialize.
