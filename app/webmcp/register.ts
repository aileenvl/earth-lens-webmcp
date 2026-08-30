import type { ModelContextTool } from "./types.ts";

interface ModelContext { registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => Promise<void> }
export function registerWebMcpTools(modelContext: ModelContext | undefined, tools: ModelContextTool[]): { ready: Promise<boolean>; cleanup: () => void } {
  const controller = new AbortController();
  if (!modelContext) return { ready: Promise.resolve(false), cleanup: () => controller.abort() };
  return {
    ready: Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).then(() => true),
    cleanup: () => controller.abort(),
  };
}
