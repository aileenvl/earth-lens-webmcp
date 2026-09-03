import type { TimeWindow } from "./types.ts";

type EventWindowStatus = {
  window: TimeWindow;
  place: string;
  radiusKm: number;
  count: number;
  loading: boolean;
  unavailable: boolean;
};

const windowLabel = (window: TimeWindow) => window === "24h" ? "the last 24 hours" : window === "7d" ? "the last 7 days" : "the last 30 days";

export function describeEventWindowStatus(status: EventWindowStatus): string {
  const period = windowLabel(status.window);
  const viirsWindowNote = status.window === "30d" ? " VIIRS only covers the latest 7 days." : "";
  if (status.loading) return `Updating earthquakes, natural events, and VIIRS thermal hotspots from USGS and NASA for ${period}.${viirsWindowNote} Air quality stays current.`;
  if (status.unavailable) return `${period[0].toUpperCase()}${period.slice(1)} applied. Some event sources are unavailable—check Live signals for coverage. Air quality stays current.`;
  if (status.count === 0) return `No USGS earthquakes, NASA natural events, or VIIRS thermal hotspots matched the ${status.radiusKm} km area around ${status.place} in ${period}.${viirsWindowNote} This is not an all-clear. Air quality stays current.`;
  return `${period[0].toUpperCase()}${period.slice(1)} applied · ${status.count} mapped evidence records around ${status.place}.${viirsWindowNote} Air quality stays current.`;
}
