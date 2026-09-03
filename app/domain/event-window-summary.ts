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
  if (status.loading) return `Updating earthquakes and natural events from USGS and NASA for ${period}. Air quality stays current.`;
  if (status.unavailable) return `${period[0].toUpperCase()}${period.slice(1)} applied. Some event sources are unavailable—check Live signals for coverage. Air quality stays current.`;
  if (status.count === 0) return `No USGS earthquakes or NASA natural events matched the ${status.radiusKm} km area around ${status.place} in ${period}. This is not an all-clear. Air quality stays current.`;
  return `${period[0].toUpperCase()}${period.slice(1)} applied · ${status.count} mapped events around ${status.place}. Air quality stays current.`;
}
