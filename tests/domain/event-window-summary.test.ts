import assert from "node:assert/strict";
import test from "node:test";

import { describeEventWindowStatus } from "../../app/domain/event-window-summary.ts";

test("explains a zero-event result without presenting it as an all-clear", () => {
  assert.equal(describeEventWindowStatus({ window: "30d", place: "CDMX", radiusKm: 100, count: 0, loading: false, unavailable: false }), "No USGS earthquakes or NASA natural events matched the 100 km area around CDMX in the last 30 days. This is not an all-clear. Air quality stays current.");
});

test("distinguishes loading, partial failure, and matching event results", () => {
  assert.match(describeEventWindowStatus({ window: "7d", place: "CDMX", radiusKm: 100, count: 0, loading: true, unavailable: false }), /^Updating/);
  assert.match(describeEventWindowStatus({ window: "24h", place: "CDMX", radiusKm: 100, count: 0, loading: false, unavailable: true }), /Some event sources are unavailable/);
  assert.match(describeEventWindowStatus({ window: "7d", place: "CDMX", radiusKm: 100, count: 3, loading: false, unavailable: false }), /3 mapped events/);
});
