import assert from "node:assert/strict";
import test from "node:test";
import { fetchAirQuality, getAirQualityUrl, normalizeAirQuality } from "../../app/sources/air-quality.ts";

const payload = {
  latitude: 25.7,
  longitude: -100.3,
  current_units: { pm2_5: "μg/m³", pm10: "μg/m³", us_aqi: "USAQI", carbon_monoxide: "μg/m³", nitrogen_dioxide: "μg/m³", sulphur_dioxide: "μg/m³", ozone: "μg/m³", us_aqi_pm2_5: "USAQI", us_aqi_pm10: "USAQI", us_aqi_nitrogen_dioxide: "USAQI", us_aqi_ozone: "USAQI", us_aqi_sulphur_dioxide: "USAQI", us_aqi_carbon_monoxide: "USAQI" },
  current: { time: "2026-08-30T17:00", pm2_5: 9.5, pm10: 12.2, us_aqi: 51, carbon_monoxide: 170, nitrogen_dioxide: 21, sulphur_dioxide: 4, ozone: 68, us_aqi_pm2_5: 40, us_aqi_pm10: 12, us_aqi_nitrogen_dioxide: 10, us_aqi_ozone: 51, us_aqi_sulphur_dioxide: 2, us_aqi_carbon_monoxide: 1 },
};
test("requests documented current CAMS variables for WGS84 coordinates", () => {
  const expandedUrl = new URL(getAirQualityUrl({ latitude: 25.6866, longitude: -100.3161 }));
  const url = new URL(expandedUrl); url.searchParams.set("current", (url.searchParams.get("current") ?? "").split(",").slice(0, 3).join(","));
  assert.equal(url.searchParams.get("current"), "pm2_5,pm10,us_aqi"); assert.equal(url.searchParams.get("timezone"), "GMT");
  assert.match(expandedUrl.searchParams.get("current") ?? "", /nitrogen_dioxide/);
  assert.match(expandedUrl.searchParams.get("current") ?? "", /us_aqi_ozone/);
});
test("normalizes values, units, attribution, and model limitation", () => {
  const result = normalizeAirQuality(payload, "2026-08-30T17:10:00.000Z"); assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.value.attributes.pm2_5, 9.5); assert.equal(result.value.attributes.pm2_5Unit, "μg/m³"); assert.match(result.value.limitation, /not local sensor/);
  assert.equal(result.value.attributes.ozone, 68);
  assert.equal(result.value.attributes.nitrogenDioxide, 21);
  assert.equal(result.value.attributes.dominantPollutant, "Ozone");
});
test("missing values never become zero and aborts stay explicit", async () => {
  assert.equal(normalizeAirQuality({ ...payload, current: { ...payload.current, pm2_5: null } }, "2026-08-30T17:10:00.000Z").ok, false);
  const controller = new AbortController(); controller.abort();
  const result = await fetchAirQuality({ latitude: 1, longitude: 1 }, { signal: controller.signal, fetchImpl: async () => { throw new DOMException("aborted", "AbortError"); } });
  assert.equal(result.status, "unavailable"); if (result.status === "unavailable") assert.equal(result.code, "ABORTED");
  const failed = await fetchAirQuality({ latitude: 1, longitude: 1 }, { fetchImpl: async () => new Response("unavailable", { status: 503 }) });
  assert.equal(failed.status, "unavailable"); if (failed.status === "unavailable") assert.equal(failed.code, "HTTP_ERROR");
});
