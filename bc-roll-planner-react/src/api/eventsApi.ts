// src/api/eventsApi.ts
import { netlifyGet } from "./netlifyClient";
import type { Event } from "../../shared/models";

export type EventsType = "upcoming" | "past";

export type EventsResponse = {
  type: EventsType;
  count: number;
  events: Event[];
};

export async function fetchEvents(params: {
  type?: EventsType;
  limit?: number | null;
  lang?: string;
  ui?: string;
  base_url?: string;
}): Promise<EventsResponse> {
  return netlifyGet<EventsResponse>("events", {
    type: params.type ?? "upcoming",
    limit: params.limit ?? null,
    lang: params.lang ?? "tw",
    ui: params.ui ?? "tw",
    base_url: params.base_url, // optional
  });
}
