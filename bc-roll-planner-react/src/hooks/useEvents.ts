// src/hooks/useEvents.ts
import { useEffect, useRef, useState } from "react";
import type { Event } from "../../shared/models";
import { fetchEvents } from "../api/eventsApi";
import { ApiError } from "../api/netlifyClient";

type LoadState = "idle" | "loading" | "ok" | "error";

export function useEvents(params: {
  type: "upcoming" | "past";
  // limit: number;
  limit?: number | null;
  lang: string;
  ui: string;
}) {
  const { type, limit, lang, ui } = params;

  const cleanLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? limit
      : undefined;

  const [eventsState, setEventsState] = useState<LoadState>("idle");
  const [eventsErr, setEventsErr] = useState<string>("");
  const [events, setEvents] = useState<Event[]>([]);

  // 避免快速切換造成舊回應覆蓋新回應
  const seqRef = useRef(0);

  async function load(t: "upcoming" | "past") {
    const seq = ++seqRef.current;
    setEventsState("loading");
    setEventsErr("");

    try {
      const res = await fetchEvents({ type: t, limit: cleanLimit, lang, ui });
      if (seq !== seqRef.current) return;
      setEvents(res.events || []);
      setEventsState("ok");
    } catch (e: any) {
      if (seq !== seqRef.current) return;
      setEventsState("error");
      setEventsErr(
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status})`
          : String(e?.message || e)
      );
    }
  }

  // mount / type change
  useEffect(() => {
    load(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, limit, lang, ui]);

  return {
    eventsState,
    eventsErr,
    events,
    reloadEvents: load,
  };
}
