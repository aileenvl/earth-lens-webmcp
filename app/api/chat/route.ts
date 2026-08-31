import { chatGPTSignInPath, getChatGPTUser } from "../../chatgpt-auth.ts";
import { parseChatRequest } from "../../chat/contract.ts";
import { requestAssistantPlan } from "../../chat/server.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: { code: "AUTH_REQUIRED", message: "Sign in with ChatGPT to ask Earth Lens.", signInPath: chatGPTSignInPath("/") } }, 401);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: { code: "ASSISTANT_NOT_CONFIGURED", message: "The Earth Lens assistant is not configured yet." } }, 503);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: { code: "INVALID_JSON", message: "The request body must be valid JSON." } }, 400); }
  const parsed = parseChatRequest(body);
  if (!parsed.ok) return json({ error: { code: "INVALID_REQUEST", message: parsed.error } }, 422);
  try {
    return json({ data: await requestAssistantPlan(parsed.value, { apiKey }) });
  } catch {
    return json({ error: { code: "ASSISTANT_UNAVAILABLE", message: "Earth Lens could not answer right now. Please try again." } }, 502);
  }
}
