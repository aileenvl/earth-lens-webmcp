import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../../app/api/chat/route.ts";

test("public chat validates anonymous requests without requiring ChatGPT identity", async () => {
  const previousApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-server-key";
  try {
    const response = await POST(new Request("https://earth-lens.test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    const body = await response.json() as { error?: { code?: string } };

    assert.equal(response.status, 400);
    assert.equal(body.error?.code, "INVALID_JSON");
  } finally {
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
  }
});
