import assert from "node:assert/strict";
import test from "node:test";

import { describeUsAqi, getAqiActivityGuidance, getUsAqiTone } from "../../app/domain/air-quality.ts";

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

test("turns AQI bands into audience-specific outdoor planning cues", () => {
  assert.deepEqual(getAqiActivityGuidance(42), {
    headline: "A good time for outdoor activity",
    general: "Most people can continue their usual outdoor activities.",
    sensitive: "Keep checking conditions if you are unusually sensitive to air pollution.",
  });
  assert.deepEqual(getAqiActivityGuidance(95), {
    headline: "Generally acceptable for outdoor activity",
    general: "Most people can continue their usual outdoor activities.",
    sensitive: "If you are unusually sensitive, consider reducing long or intense outdoor activity if you notice symptoms.",
  });
  assert.match(getAqiActivityGuidance(132).sensitive, /shorter or less intense/);
  assert.match(getAqiActivityGuidance(188).general, /reduc/);
  assert.match(getAqiActivityGuidance(250).general, /avoid/i);
  assert.match(getAqiActivityGuidance(350).general, /official local guidance/);
});
