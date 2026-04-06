// src/features/events/model/useEvents.ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { Event } from "@/types/models";
import { fetchEventsBoth } from "./api";
import { ApiError } from "@/lib/api-client";

import type { LoadState } from "@/lib/loadState";

export function useEvents(params: {
  pastLimit?: number | null;
  lang: string;
  ui: string;
}) {
  const { pastLimit, lang, ui } = params;

  const cleanPastLimit =
    typeof pastLimit === "number" && Number.isFinite(pastLimit) && pastLimit > 0
      ? pastLimit
      : undefined;

  const [eventsState, setEventsState] = useState<LoadState>("idle");
  const [eventsErr, setEventsErr] = useState<string>("");

  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);

  // ✅ 合併 events：用 useMemo 穩定 reference，避免每次 render 都 new array
  const events = useMemo(() => {
    return [...upcomingEvents, ...pastEvents];
  }, [upcomingEvents, pastEvents]);

  // 避免快速刷新造成舊回應覆蓋新回應
  const seqRef = useRef(0);

  async function load() {
    const seq = ++seqRef.current;
    setEventsState("loading");
    setEventsErr("");

    try {
      const res = await fetchEventsBoth({
        pastLimit: cleanPastLimit ?? null,
        lang,
        ui,
      });

      if (seq !== seqRef.current) return;

      setUpcomingEvents(res.upcoming.events || []);
      setPastEvents(res.past.events || []);
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanPastLimit, lang, ui]);

  return {
    eventsState,
    eventsErr,

    upcomingEvents,
    pastEvents,

    // ✅ 合併後的 events（上 upcoming 下 past）
    events,

    reloadEvents: load,
  };
}
