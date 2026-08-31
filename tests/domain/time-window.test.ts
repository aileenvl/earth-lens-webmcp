import assert from "node:assert/strict";
import test from "node:test";

import { stepTimeWindow } from "../../app/domain/time-window.ts";

test("steps through the supported windows and clamps at both ends", () => {
  assert.equal(stepTimeWindow("24h", "next"), "7d");
  assert.equal(stepTimeWindow("7d", "next"), "30d");
  assert.equal(stepTimeWindow("30d", "next"), "30d");
  assert.equal(stepTimeWindow("30d", "previous"), "7d");
  assert.equal(stepTimeWindow("24h", "previous"), "24h");
});
