import { useEffect, useState } from "react";
import type { Event } from "../../../shared/models";
import type { LoadState } from "../../ui/types";
import { fetchEvents } from "../../api/eventsApi";
import { ApiError } from "../../api/netlifyClient";

export function useEvents(eventsType: "upcoming" | "past") {
  const [state, setState] = useState<LoadState>("idle");
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string>("");

  async function reload() {
    setState("loading");
    setError("");
    try {
      const res = await fetchEvents({
        type: eventsType,
        limit: 60,
        lang: "tw",
        ui: "tw",
      });
      setEvents(res.events || []);
      setState("ok");
    } catch (e: any) {
      setState("error");
      setError(
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status})`
          : String(e?.message || e)
      );
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsType]);

  return { state, events, error, reload };
}
