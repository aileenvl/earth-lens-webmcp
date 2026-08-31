import type { TimeWindow } from "./types.ts";

const windows: TimeWindow[] = ["24h", "7d", "30d"];

export function stepTimeWindow(current: TimeWindow, direction: "previous" | "next"): TimeWindow {
  const offset = direction === "previous" ? -1 : 1;
  const index = Math.min(windows.length - 1, Math.max(0, windows.indexOf(current) + offset));
  return windows[index];
}
