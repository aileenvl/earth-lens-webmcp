import assert from "node:assert/strict";
import test from "node:test";

import { describeUsAqi } from "../../app/domain/air-quality.ts";

test("describes US AQI bands in plain language", () => {
  assert.deepEqual(describeUsAqi(42), { label: "Good", guidance: "Air pollution is low for most people." });
  assert.deepEqual(describeUsAqi(78), { label: "Moderate", guidance: "Some unusually sensitive people may be affected." });
  assert.equal(describeUsAqi(132).label, "Unhealthy for sensitive groups");
  assert.equal(describeUsAqi(188).label, "Unhealthy");
  assert.equal(describeUsAqi(250).label, "Very unhealthy");
  assert.equal(describeUsAqi(350).label, "Hazardous");
});
