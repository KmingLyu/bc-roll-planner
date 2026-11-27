import type { Event, TrackGraph } from "@/types/models";
import { fetchTrackGraph } from "./api";
import { eventRequestMetadata } from "@/features/events";

export async function fetchTrackGraphs(params: {
  seed: string;
  count: number;
  selectedEventValues: string[];
  eventsByValue: Map<string, Event>;
  lang: string;
  ui: string;
  signal: AbortSignal;
}): Promise<Record<string, TrackGraph>> {
  const { seed, count, selectedEventValues, eventsByValue, lang, ui, signal } = params;
  if (!seed.trim() || !Number.isFinite(count) || count <= 0 || !selectedEventValues.length) {
    return {};
  }
  const results = await Promise.all(selectedEventValues.map(async (eventValue) => {
    const response = await fetchTrackGraph({
      ...eventRequestMetadata(eventValue, eventsByValue),
      seed: seed.trim(), count, signal, lang, ui,
    });
    return [eventValue, response.graph] as const;
  }));
  return Object.fromEntries(results);
}
