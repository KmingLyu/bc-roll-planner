// src/hooks/useTrackGraphs.ts
import { useRef, useState } from "react";
import type { Event, TrackGraph } from "../../shared/models";
import { fetchTrackGraph } from "../api/trackGraphApi";
import { ApiError } from "../api/netlifyClient";

type LoadState = "idle" | "loading" | "ok" | "error";

export function useTrackGraphs(params: {
  seed: string;
  count: number;
  selectedEventValues: string[];
  eventsByValue: Map<string, Event>;
  lang: string;
  ui: string;
}) {
  const { seed, count, selectedEventValues, eventsByValue, lang, ui } = params;

  const [graphState, setGraphState] = useState<LoadState>("idle");
  const [graphErr, setGraphErr] = useState<string>("");
  const [graphByEvent, setGraphByEvent] = useState<Record<string, TrackGraph>>(
    {}
  );

  const seqRef = useRef(0);

  function clearGraphs() {
    setGraphState("idle");
    setGraphErr("");
    setGraphByEvent({});
  }

  async function fetchGraphs() {
    const s = seed.trim();
    const c = Number(count);
    if (selectedEventValues.length === 0) {
      // 建議：同時把狀態回到 idle，避免 UI 還顯示 loading/error
      setGraphState("idle");
      setGraphErr("");
      return;
    }
    if (!selectedEventValues.length) throw new Error("no selected events");
    if (!s || !Number.isFinite(c) || c <= 0)
      throw new Error("invalid seed/count");

    const seq = ++seqRef.current;
    setGraphState("loading");
    setGraphErr("");

    try {
      const results = await Promise.all(
        selectedEventValues.map(async (ev) => {
          const meta = eventsByValue.get(ev) || null;
          const res = await fetchTrackGraph({
            seed: s,
            event: ev,
            count: c,
            lang,
            ui,
            name: meta?.name ?? ev,
            start_date: meta?.start_date ?? null,
            end_date: meta?.end_date ?? null,
          });
          return { ev, graph: res.graph };
        })
      );

      if (seq !== seqRef.current) return;

      const next: Record<string, TrackGraph> = {};
      for (const r of results) next[r.ev] = r.graph;

      setGraphByEvent(next);
      setGraphState("ok");
    } catch (e: any) {
      if (seq !== seqRef.current) return;
      setGraphState("error");
      setGraphErr(
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status})`
          : String(e?.message || e)
      );
      throw e;
    }
  }

  return {
    graphState,
    graphErr,
    graphByEvent,
    fetchGraphs,
    clearGraphs,
  };
}
