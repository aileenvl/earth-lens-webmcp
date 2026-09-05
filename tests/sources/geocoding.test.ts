import assert from "node:assert/strict";
import test from "node:test";

import { resolvePlace } from "../../app/sources/geocoding.ts";

test("resolves a worldwide locality into a validated WGS84 candidate", async () => {
  const fetcher: typeof fetch = async (input) => {
    assert.match(String(input), /singleLine=CDMX/);
    return Response.json({ candidates: [
      { address: "Cdmx, Ciudad de México", location: { x: -99.12766, y: 19.42847 }, score: 100, attributes: { Addr_type: "Locality" } },
      { address: "Cdmx", location: { x: -43.1197, y: -22.8939 }, score: 100, attributes: { Addr_type: "POI" } },
    ] });
  };

  const result = await resolvePlace("CDMX", { fetcher });

  assert.deepEqual(result, { status: "resolved", candidate: { label: "Cdmx, Ciudad de México", latitude: 19.42847, longitude: -99.12766, score: 100, type: "Locality" } });
});

test("returns choices instead of guessing between equally strong places", async () => {
  const fetcher: typeof fetch = async () => Response.json({ candidates: [
    { address: "Springfield, Illinois", location: { x: -89.65, y: 39.78 }, score: 100, attributes: { Addr_type: "Locality" } },
    { address: "Springfield, Missouri", location: { x: -93.29, y: 37.21 }, score: 100, attributes: { Addr_type: "Locality" } },
  ] });

  const result = await resolvePlace("Springfield", { fetcher });

  assert.equal(result.status, "ambiguous");
  if (result.status === "ambiguous") assert.equal(result.candidates.length, 2);
});

test("uses the shared map area to resolve a clearly nearer same-name locality", async () => {
  const fetcher: typeof fetch = async () => Response.json({ candidates: [
    { address: "Monterrey, Nuevo León", location: { x: -100.3421, y: 25.7091 }, score: 100, attributes: { Addr_type: "Locality" } },
    { address: "Monterrey, Nuevo León", location: { x: -100.3185, y: 25.6751 }, score: 100, attributes: { Addr_type: "Locality" } },
    { address: "Monterrey, Casanare", location: { x: -72.8458, y: 4.8407 }, score: 100, attributes: { Addr_type: "Locality" } },
  ] });

  const result = await resolvePlace("Monterrey", { fetcher, near: { latitude: 19.42847, longitude: -99.12766 } });

  assert.equal(result.status, "resolved");
  if (result.status === "resolved") assert.equal(result.candidate.label, "Monterrey, Nuevo León");
});

test("biases ArcGIS toward the shared map so General Escobedo is not excluded", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("location"), "-100.3161,25.6866");
    return Response.json({ candidates: [
      { address: "Escobedo", location: { x: -100.3161561, y: 25.7826073 }, score: 100, attributes: { Addr_type: "POI" } },
      { address: "Escobedo, Nuevo León", location: { x: -100.3515, y: 25.80399 }, score: 100, attributes: { Addr_type: "Locality" } },
      { address: "Escobedo, San Juan, General Escobedo, Nuevo León", location: { x: -100.339639167, y: 25.839436667 }, score: 100, attributes: { Addr_type: "Locality" } },
      { address: "Escobedo, Montemorelos, Nuevo León", location: { x: -99.87044, y: 25.16735 }, score: 100, attributes: { Addr_type: "Locality" } },
    ] });
  };

  const result = await resolvePlace("Escobedo", { fetcher, near: { latitude: 25.6866, longitude: -100.3161 } });

  assert.deepEqual(result, { status: "resolved", candidate: { label: "Escobedo, Nuevo León", latitude: 25.80399, longitude: -100.3515, score: 100, type: "Locality" } });
});

test("collapses nearby locality aliases into one city result", async () => {
  const fetcher: typeof fetch = async () => Response.json({ candidates: [
    { address: "Mexico City, Ciudad de México", location: { x: -99.1417, y: 19.4305 }, score: 100, attributes: { Addr_type: "Locality" } },
    { address: "Mexico City", location: { x: -99.1277, y: 19.4285 }, score: 100, attributes: { Addr_type: "Locality" } },
    { address: "Ciudad de México", location: { x: -99.1394, y: 19.2769 }, score: 100, attributes: { Addr_type: "Locality" } },
  ] });

  const result = await resolvePlace("Mexico City (CDMX)", { fetcher });

  assert.equal(result.status, "resolved");
  if (result.status === "resolved") assert.equal(result.candidate.label, "Mexico City, Ciudad de México");
});

test("rejects invalid queries and malformed provider responses", async () => {
  await assert.rejects(resolvePlace(" ", { fetcher: fetch }), /Place query/);
  const malformed = await resolvePlace("CDMX", { fetcher: async () => Response.json({ candidates: [{ address: "Bad", location: { x: 900, y: 900 }, score: 100, attributes: {} }] }) });
  assert.deepEqual(malformed, { status: "not-found", reason: "No valid place candidates were returned." });
});
