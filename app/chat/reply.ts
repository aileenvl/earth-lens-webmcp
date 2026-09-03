import type { ChatActionName } from "./contract.ts";

export type ExecutedAssistantAction = {
  actionName: ChatActionName;
  ok: boolean;
  summary: string;
  detail?: string;
};

export function composeAssistantReply(answer: string, outcomes: ExecutedAssistantAction[]): string {
  const placeChange = outcomes.find((outcome) => outcome.actionName === "focus_place");
  if (placeChange) return placeChange.detail ?? placeChange.summary;
  return [answer, ...outcomes.flatMap((outcome) => outcome.detail ? [outcome.detail] : [])].join("\n\n");
}
