import assert from "node:assert/strict";
import test from "node:test";
import { fetchAirQuality, getAirQualityUrl, normalizeAirQuality } from "../../app/sources/air-quality.ts";

const payload = { latitude: 25.7, longitude: -100.3, current_units: { pm2_5: "μg/m³", pm10: "μg/m³", us_aqi: "USAQI" }, current: { time: "2026-08-30T17:00", pm2_5: 9.5, pm10: 12.2, us_aqi: 51 } };
test("requests documented current CAMS variables for WGS84 coordinates", () => {
  const url = new URL(getAirQualityUrl({ latitude: 25.6866, longitude: -100.3161 }));
  assert.equal(url.searchParams.get("current"), "pm2_5,pm10,us_aqi"); assert.equal(url.searchParams.get("timezone"), "GMT");
});
test("normalizes values, units, attribution, and model limitation", () => {
  const result = normalizeAirQuality(payload, "2026-08-30T17:10:00.000Z"); assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.value.attributes.pm2_5, 9.5); assert.equal(result.value.attributes.pm2_5Unit, "μg/m³"); assert.match(result.value.limitation, /not local sensor/);
});
test("missing values never become zero and aborts stay explicit", async () => {
  assert.equal(normalizeAirQuality({ ...payload, current: { ...payload.current, pm2_5: null } }, "2026-08-30T17:10:00.000Z").ok, false);
  const controller = new AbortController(); controller.abort();
  const result = await fetchAirQuality({ latitude: 1, longitude: 1 }, { signal: controller.signal, fetchImpl: async () => { throw new DOMException("aborted", "AbortError"); } });
  assert.equal(result.status, "unavailable"); if (result.status === "unavailable") assert.equal(result.code, "ABORTED");
  const failed = await fetchAirQuality({ latitude: 1, longitude: 1 }, { fetchImpl: async () => new Response("unavailable", { status: 503 }) });
  assert.equal(failed.status, "unavailable"); if (failed.status === "unavailable") assert.equal(failed.code, "HTTP_ERROR");
});
