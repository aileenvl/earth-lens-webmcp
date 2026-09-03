import assert from "node:assert/strict";
import test from "node:test";

import { composeAssistantReply } from "../../app/chat/reply.ts";

test("a place-changing reply uses refreshed action evidence instead of a model claim", () => {
  const reply = composeAssistantReply("Monterrey has AQI 55.", [
    { actionName: "focus_place", ok: true, summary: "Focused Monterrey", detail: "Monterrey, Nuevo León: US AQI 95 — Moderate." },
  ]);

  assert.equal(reply, "Monterrey, Nuevo León: US AQI 95 — Moderate.");
});

test("a failed place change never presents the model's unverified city answer", () => {
  const reply = composeAssistantReply("Monterrey has AQI 55.", [
    { actionName: "focus_place", ok: false, summary: "I could not move the map: choose a more specific place." },
  ]);

  assert.equal(reply, "I could not move the map: choose a more specific place.");
});

test("same-area replies retain the answer and append evidence opened by tools", () => {
  const reply = composeAssistantReply("Current evidence is moderate.", [
    { actionName: "inspect_observation", ok: true, summary: "Opened evidence", detail: "US AQI 72 — Moderate." },
  ]);

  assert.equal(reply, "Current evidence is moderate.\n\nUS AQI 72 — Moderate.");
});
