import type { Event } from "@/types/models";

export function eventRequestMetadata(eventValue: string, eventsByValue: Map<string, Event>) {
  const event = eventsByValue.get(eventValue);
  return {
    event: eventValue,
    name: event?.name ?? eventValue,
    raw_name: event?.raw_name ?? event?.name ?? eventValue,
    start_date: event?.start_date ?? null,
    end_date: event?.end_date ?? null,
    pool_type: event?.pool_type ?? "normal" as const,
  };
}
