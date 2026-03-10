// src/features/track-graph/model/useTrackGraphs.ts
import { useRef, useState } from "react";
import type { Event, TrackGraph } from "@/types/models";
import { fetchTrackGraph } from "@/features/track-graph/api/getTrackGraph";
import { ApiError } from "@/lib/api-client";

type LoadState = "idle" | "loading" | "ok" | "error";

function isValidSeedCount(seed: string, count: number): boolean {
  const s = seed.trim();
  if (!s) return false;
  if (!Number.isFinite(count)) return false;
  if (count <= 0) return false;
  return true;
}

export function useTrackGraphs(params: {
  seed: string;
  selectedEventValues: string[];
  eventsByValue: Map<string, Event>;
  lang: string;
  ui: string;
}) {
  const { seed, selectedEventValues, eventsByValue, lang, ui } = params;

  const [graphState, setGraphState] = useState<LoadState>("idle");
  const [graphErr, setGraphErr] = useState<string>("");
  const [graphByEvent, setGraphByEvent] = useState<Record<string, TrackGraph>>(
    {}
  );

  const seqRef = useRef(0);

  // 保存最新結果，避免 click handler 讀到舊 state
  const latestGraphsRef = useRef<Record<string, TrackGraph>>({});

  function clearGraphs() {
    setGraphState("idle");
    setGraphErr("");
    setGraphByEvent({});
    latestGraphsRef.current = {};
  }

  // 回傳 next graphs
  async function fetchGraphs(count: number): Promise<Record<string, TrackGraph>> {
    // 沒選 event：回到 idle，回傳空
    if (selectedEventValues.length === 0) {
      setGraphState("idle");
      setGraphErr("");
      latestGraphsRef.current = {};
      setGraphByEvent({});
      return {};
    }

    // seed/count 不合法：不要打 API、不要 throw，回到 idle，回傳空
    if (!isValidSeedCount(seed, count)) {
      setGraphState("idle");
      setGraphErr("");
      // 參數不完整就視為不可用，所以這裡乾脆也清空，避免 UI 誤顯示舊資料
      latestGraphsRef.current = {};
      setGraphByEvent({});
      return {};
    }

    const s = seed.trim();
    const c = count;

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
            pool_type: meta?.pool_type ?? "normal",
          });
          return { ev, graph: res.graph };
        })
      );

      // 過期請求：不覆蓋 state，回傳最新已知結果
      if (seq !== seqRef.current) {
        return latestGraphsRef.current;
      }

      const next: Record<string, TrackGraph> = {};
      for (const r of results) next[r.ev] = r.graph;

      latestGraphsRef.current = next;
      setGraphByEvent(next);
      setGraphState("ok");
      return next;
    } catch (e: any) {
      // 過期請求失敗：不覆蓋最新狀態，回傳最新已知
      if (seq !== seqRef.current) {
        return latestGraphsRef.current;
      }

      setGraphState("error");
      setGraphErr(
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status})`
          : String(e?.message || e)
      );
      throw e;
    }
  }

  return { graphState, graphErr, graphByEvent, fetchGraphs, clearGraphs };
}
