"use client";

import { useState, type FormEvent } from "react";

import { parseAssistantPlan, type AssistantAction, type ChatHistoryItem, type ChatWorkspace } from "../chat/contract.ts";
import { composeAssistantReply } from "../chat/reply.ts";

type Message = ChatHistoryItem & { id: number; actions?: string[] };
export type AssistantActionResult = { ok: boolean; summary: string; detail?: string };
type AssistantChatProps = {
  workspace: ChatWorkspace;
  onAction: (action: AssistantAction) => Promise<AssistantActionResult>;
};

export function AssistantChat({ workspace, onAction }: AssistantChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<{ message: string; signInPath?: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || isThinking) return;
    const userMessage: Message = { id: Date.now(), role: "user", content: message };
    const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
    setIsThinking(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history, workspace }),
      });
      const body = await response.json() as { data?: unknown; error?: { message?: string; signInPath?: string } };
      if (!response.ok || !body.data) {
        setError({ message: body.error?.message ?? "Earth Lens could not answer right now.", signInPath: body.error?.signInPath });
        return;
      }
      const plan = parseAssistantPlan(body.data);
      if (!plan.ok) throw new Error("Invalid assistant response");
      const actionResults: Array<AssistantActionResult & { actionName: AssistantAction["name"] }> = [];
      for (const action of plan.value.actions) actionResults.push({ actionName: action.name, ...await onAction(action) });
      setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", content: composeAssistantReply(plan.value.answer, actionResults), actions: actionResults.map((result) => result.summary) }]);
    } catch {
      setError({ message: "Earth Lens could not reach the assistant. Please try again." });
    } finally {
      setIsThinking(false);
    }
  }

  return (
    <section className="assistantChat" aria-labelledby="assistant-title">
      <div className="assistantHeading">
        <span className="agentIcon" aria-hidden="true">✦</span>
        <div><strong id="assistant-title">Ask Earth Lens</strong><span>Researches with site tools · actions stay visible</span></div>
      </div>
      <div className="chatMessages" aria-live="polite">
        {messages.length === 0 && <div className="chatWelcome"><p>Ask about a place or choose a starting point. Earth Lens will move the shared map and open the evidence it used.</p><div className="chatStarters" aria-label="Example questions"><button type="button" onClick={() => setInput("Is the air suitable for outdoor activities here today?")}>Outdoor plans?</button><button type="button" onClick={() => setInput("Show earthquakes and natural events here from the last 7 days")}>Last 7 days</button><button type="button" onClick={() => setInput("What is the air quality around Monterrey Nuevo León?")}>Try another city</button></div></div>}
        {messages.map((message) => (
          <div className={`chatMessage ${message.role}`} key={message.id}>
            <b>{message.role === "user" ? "You" : "Earth Lens"}</b>
            <p>{message.content}</p>
            {message.actions?.map((action) => <small key={action}>✓ {action}</small>)}
          </div>
        ))}
        {isThinking && <p className="chatThinking" role="status">Earth Lens is examining the current map…</p>}
      </div>
      {error && <div className="chatError" role="alert"><span>{error.message}</span>{error.signInPath && <a href={error.signInPath}>Sign in with ChatGPT</a>}</div>}
      <form onSubmit={submit}>
        <label htmlFor="earth-lens-question">Your question or instruction</label>
        <div>
          <textarea id="earth-lens-question" value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} rows={2} placeholder="What should I know about this area?" />
          <button type="submit" disabled={!input.trim() || isThinking}>{isThinking ? "Thinking…" : "Ask"}</button>
        </div>
      </form>
      <p className="chatPrivacy">Questions and the current evidence snapshot are sent to OpenAI. Do not enter personal or sensitive information.</p>
    </section>
  );
}
