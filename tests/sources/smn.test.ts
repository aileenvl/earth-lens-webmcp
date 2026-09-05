import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gzipSync } from "node:zlib";

import {
  fetchSmnForecast,
  getSmnForecastUrl,
  normalizeSmnDailyForecast,
  SMN_DAILY_SOURCE_URL,
} from "../../app/sources/smn.ts";
import { handleSmnRequest, type CacheLike } from "../../app/sources/smn-server.ts";

const fetchedAt = "2026-09-03T23:55:00.000Z";
const sourceUpdatedAt = "2026-09-03T23:54:38.000Z";
const monterrey = { latitude: 25.6866, longitude: -100.3161 };

async function fixture(): Promise<unknown> {
  return JSON.parse(await readFile(new URL("../fixtures/smn-daily.json", import.meta.url), "utf8"));
}

test("normalizes the nearest municipality forecast with official provenance", async () => {
  const result = normalizeSmnDailyForecast(await fixture(), monterrey, fetchedAt, sourceUpdatedAt);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.sourceUrl, SMN_DAILY_SOURCE_URL);
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].id, "smn:19-39-20260903T00");
  assert.equal(result.data[0].provider, "smn");
  assert.equal(result.data[0].evidenceType, "weather-forecast");
  assert.equal(result.data[0].observedAt, "2026-09-03T06:00:00.000Z");
  assert.deepEqual(result.data[0].coordinates, { latitude: 25.6647, longitude: -100.3109 });
  assert.deepEqual(result.data[0].attributes, {
    stateId: "19",
    municipalityId: "39",
    stateName: "Nuevo León",
    municipalityName: "Monterrey",
    forecastDay: 0,
    minimumTemperatureC: 20.1,
    maximumTemperatureC: 36.7,
    precipitationMm: 1.3,
    precipitationProbabilityPercent: 50,
    windSpeedKmh: 6.1,
    windDirection: "Sureste",
    windDirectionDegrees: 135,
    gustSpeedKmh: 25.2,
    cloudCoverPercent: 1.7,
    sky: "Poco nuboso",
    sourceUpdatedAt,
    distanceFromSelectionKm: 2.49,
  });
  assert.match(result.data[0].limitation, /municipal forecast/i);
  assert.match(result.data[0].limitation, /not.*station observation/i);
});

test("caps a municipality outlook at four days and rejects malformed records", async () => {
  const base = (await fixture()) as Array<Record<string, unknown>>;
  const many = Array.from({ length: 6 }, (_, index) => ({
    ...base[0],
    ndia: String(index),
    dloc: `2026090${index + 3}T00`,
  }));
  const capped = normalizeSmnDailyForecast(many, monterrey, fetchedAt, sourceUpdatedAt);
  assert.equal(capped.status === "ready" && capped.data.length, 4);

  const malformed = normalizeSmnDailyForecast(
    [{ ...base[0], tmax: "not-a-temperature" }],
    monterrey,
    fetchedAt,
    sourceUpdatedAt,
  );
  assert.equal(malformed.status, "unavailable");
});

test("reports unsupported coverage instead of selecting a distant Mexican municipality", async () => {
  const result = normalizeSmnDailyForecast(
    await fixture(),
    { latitude: 40.7128, longitude: -74.006 },
    fetchedAt,
    sourceUpdatedAt,
  );
  assert.equal(result.status, "empty");
  if (result.status === "empty") assert.match(result.reason, /does not cover/i);
});

test("serves a bounded response and reuses the cached compressed feed", async () => {
  const compressed = gzipSync(JSON.stringify(await fixture()));
  let upstreamRequests = 0;
  const stored = new Map<string, Response>();
  const cache: CacheLike = {
    async match(request) {
      return stored.get(request.url)?.clone();
    },
    async put(request, response) {
      stored.set(request.url, response.clone());
    },
  };
  const fetchImpl: typeof fetch = async (input) => {
    upstreamRequests += 1;
    assert.equal(String(input), "https://smn.conagua.gob.mx/tools/GUI/webservices/?method=1");
    return new Response(compressed, {
      headers: {
        "content-type": "application/octet-stream",
        "last-modified": "Thu, 03 Sep 2026 23:54:38 GMT",
        "set-cookie": "must-not-be-cached=1",
      },
    });
  };

  const request = new Request("https://earth-lens.test/api/smn?latitude=25.6866&longitude=-100.3161");
  const first = await handleSmnRequest(request, { cache, fetchImpl, now: () => fetchedAt });
  const second = await handleSmnRequest(request, { cache, fetchImpl, now: () => fetchedAt });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(upstreamRequests, 1);
  assert.equal(first.headers.get("cache-control"), "public, max-age=300");
  const body = await second.json() as { status: string; data: Array<{ provider: string }> };
  assert.equal(body.status, "ready");
  assert.equal(body.data.length, 2);
  assert.deepEqual([...new Set(body.data.map((record) => record.provider))], ["smn"]);
  const cached = stored.values().next().value as Response;
  assert.equal(cached.headers.get("set-cookie"), null);
  assert.equal(cached.headers.get("cache-control"), "public, max-age=4500");
});

test("still serves forecasts when the hosting runtime denies its optional cache", async () => {
  const compressed = gzipSync(JSON.stringify(await fixture()));
  const deniedCache: CacheLike = {
    async match() {
      throw new Error("Default cache is not permitted.");
    },
    async put() {
      throw new Error("Default cache is not permitted.");
    },
  };

  const response = await handleSmnRequest(
    new Request("https://earth-lens.test/api/smn?latitude=25.6866&longitude=-100.3161"),
    {
      cache: deniedCache,
      fetchImpl: async () => new Response(compressed),
      now: () => fetchedAt,
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json() as { status: string; data?: unknown[] };
  assert.equal(body.status, "ready");
  assert.equal(body.data?.length, 2);
});

test("validates requests and contains upstream failures", async () => {
  const missing = await handleSmnRequest(new Request("https://earth-lens.test/api/smn"));
  assert.equal(missing.status, 400);

  const invalid = await handleSmnRequest(
    new Request("https://earth-lens.test/api/smn?latitude=999&longitude=0"),
  );
  assert.equal(invalid.status, 400);

  const failed = await handleSmnRequest(
    new Request("https://earth-lens.test/api/smn?latitude=25.6866&longitude=-100.3161"),
    { fetchImpl: async () => new Response("unavailable", { status: 503 }), now: () => fetchedAt },
  );
  assert.equal(failed.status, 200);
  const body = await failed.json() as { status: string; code: string };
  assert.deepEqual({ status: body.status, code: body.code }, { status: "unavailable", code: "HTTP_ERROR" });
});

test("contains malformed compressed data and upstream timeouts", async () => {
  const request = new Request("https://earth-lens.test/api/smn?latitude=25.6866&longitude=-100.3161");
  const malformed = await handleSmnRequest(request, {
    fetchImpl: async () => new Response("not gzip"),
    now: () => fetchedAt,
  });
  const malformedBody = await malformed.json() as { status: string; code: string };
  assert.deepEqual(
    { status: malformedBody.status, code: malformedBody.code },
    { status: "unavailable", code: "INVALID_RESPONSE" },
  );

  const timedOut = await handleSmnRequest(request, {
    timeoutMs: 1,
    now: () => fetchedAt,
    fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")));
    }),
  });
  const timeoutBody = await timedOut.json() as { status: string; code: string };
  assert.deepEqual(
    { status: timeoutBody.status, code: timeoutBody.code },
    { status: "unavailable", code: "TIMEOUT" },
  );
});

test("uses the bounded same-origin endpoint and validates its result envelope", async () => {
  const url = new URL(getSmnForecastUrl(monterrey), "https://earth-lens.test");
  assert.equal(url.pathname, "/api/smn");
  assert.equal(url.searchParams.get("latitude"), "25.6866");
  assert.equal(url.searchParams.get("longitude"), "-100.3161");

  const normalized = normalizeSmnDailyForecast(await fixture(), monterrey, fetchedAt, sourceUpdatedAt);
  const ready = await fetchSmnForecast(monterrey, {
    fetchImpl: async () => new Response(JSON.stringify(normalized)),
  });
  assert.equal(ready.status === "ready" && ready.data.length, 2);

  const malformed = await fetchSmnForecast(monterrey, {
    fetchImpl: async () => new Response(JSON.stringify({ status: "ready", data: [{ provider: "smn" }] })),
  });
  assert.equal(malformed.status, "unavailable");
  if (malformed.status === "unavailable") assert.equal(malformed.code, "INVALID_RESPONSE");
});
