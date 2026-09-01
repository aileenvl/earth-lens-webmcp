import assert from "node:assert/strict";
import test from "node:test";

import { describeUsAqi, getUsAqiTone } from "../../app/domain/air-quality.ts";

test("describes US AQI bands in plain language", () => {
  assert.deepEqual(describeUsAqi(42), { label: "Good", guidance: "Air pollution is low for most people." });
  assert.deepEqual(describeUsAqi(78), { label: "Moderate", guidance: "Some unusually sensitive people may be affected." });
  assert.equal(describeUsAqi(132).label, "Unhealthy for sensitive groups");
  assert.equal(describeUsAqi(188).label, "Unhealthy");
  assert.equal(describeUsAqi(250).label, "Very unhealthy");
  assert.equal(describeUsAqi(350).label, "Hazardous");
});

test("maps US AQI bands to stable visual tones", () => {
  assert.equal(getUsAqiTone(42), "good");
  assert.equal(getUsAqiTone(78), "moderate");
  assert.equal(getUsAqiTone(132), "sensitive");
  assert.equal(getUsAqiTone(188), "unhealthy");
  assert.equal(getUsAqiTone(250), "very-unhealthy");
  assert.equal(getUsAqiTone(350), "hazardous");
});
