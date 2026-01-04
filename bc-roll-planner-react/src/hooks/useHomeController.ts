import { useEffect, useMemo, useRef, useState } from "react";
import type { Event, TrackGraph } from "../../shared/models";
import type { LoadState } from "../ui/types";

import { useEvents } from "../features/events/useEvents";
import { useEventCats } from "../features/targetCats/useEventCats";
import { fetchGraphOrThrow } from "../features/trackGraph/useTrackGraph";
import { useSimulatorState } from "../features/simulator/useSimulatorState";

import type { PlanResult } from "../core/planner";
import type { PlannerWorkerResponse } from "../workers/planner.worker";
import PlannerWorker from "../workers/planner.worker?worker";
import { usePlannerWorker } from "../features/planner/usePlannerWorker";

import type { TierGroup } from "../uiTypes/homeTypes";
import type { PlannerResources } from "../features/planner/PlannerSection";

type WorkerResp = PlannerWorkerResponse;

function clampInt(n: number, min: number) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.max(min, x);
}

export function useHomeController() {
  // -------------------------
  // Events
  // -------------------------
  const [eventsType, setEventsType] = useState<"upcoming" | "past">("upcoming");
  const {
    state: eventsState,
    events,
    error: eventsErr,
    reload: reloadEvents,
  } = useEvents(eventsType);

  // ⭐預留多選：用 string[]
  const [selectedEventValues, setSelectedEventValues] = useState<string[]>([]);
  const activeEventValue = selectedEventValues[0] || "";

  const activeEvent: Event | null = useMemo(() => {
    return events.find((e) => e.value === activeEventValue) || null;
  }, [events, activeEventValue]);

  // events 載完若還沒選，就自動選第一個
  useEffect(() => {
    if (eventsState === "ok" && events.length && !selectedEventValues.length) {
      setSelectedEventValues([events[0].value]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsState, events]);

  // -------------------------
  // seed/count（graph/cats 共用）
  // -------------------------
  const [seed, setSeed] = useState("1234");
  const [count, setCount] = useState(120);

  // -------------------------
  // Target Cats
  // -------------------------
  const {
    state: catsState,
    error: catsErr,
    groups: catGroups,
  } = useEventCats({
    seed,
    count,
    activeEvent,
  });

  const [targetCatIds, setTargetCatIds] = useState<number[]>([]);

  // 反查名稱（給 planner 缺少目標顯示）
  const catNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of catGroups as TierGroup[])
      for (const c of g.cats) m.set(c.id, c.name);
    return m;
  }, [catGroups]);

  // 修剪：cats 變更後，把不在列表的已選目標移除
  useEffect(() => {
    if (catsState !== "ok") return;
    const allowed = new Set<number>();
    for (const g of catGroups) for (const c of g.cats) allowed.add(c.id);
    setTargetCatIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [catsState, catGroups]);

  // -------------------------
  // TrackGraph（手動 fetch / 被 planner ensure）
  // -------------------------
  const [graphState, setGraphState] = useState<LoadState>("idle");
  const [graphErr, setGraphErr] = useState<string>("");
  const [graph, setGraph] = useState<TrackGraph | null>(null);
  const [showGraphRaw, setShowGraphRaw] = useState(false);

  // cache：key = event|seed|count
  const graphCacheRef = useRef<Map<string, TrackGraph>>(new Map());
  const graphKeyRef = useRef<string>("");

  function makeGraphKey(evValue: string, s: string, c: number) {
    return `${evValue}__${s.trim()}__${Number(c)}`;
  }

  async function fetchGraphManual() {
    const ev = activeEvent;
    if (!ev) {
      setGraphState("error");
      setGraphErr("event 不可為空（請先載入 events 或手動輸入）");
      return;
    }
    if (!seed.trim()) {
      setGraphState("error");
      setGraphErr("seed 不可為空");
      return;
    }
    if (!Number.isFinite(count) || count <= 0) {
      setGraphState("error");
      setGraphErr("count 必須是正整數");
      return;
    }

    const key = makeGraphKey(ev.value, seed, count);
    const cached = graphCacheRef.current.get(key);
    if (cached) {
      graphKeyRef.current = key;
      setGraph(cached);
      setGraphState("ok");
      setGraphErr("");
      return;
    }

    setGraphState("loading");
    setGraphErr("");
    setGraph(null);

    try {
      const g = await fetchGraphOrThrow({ seed, count, event: ev });
      graphCacheRef.current.set(key, g);
      graphKeyRef.current = key;
      setGraph(g);
      setGraphState("ok");
    } catch (e: any) {
      setGraphState("error");
      setGraphErr(String(e?.message || e));
    }
  }

  // ⭐給 planner 用：確保 graph 存在且和當前 event/seed/count 對應
  async function ensureGraph(): Promise<TrackGraph | null> {
    const ev = activeEvent;
    if (!ev) {
      setGraphState("error");
      setGraphErr("event 不可為空（請先選擇 event）");
      return null;
    }
    const key = makeGraphKey(ev.value, seed, count);

    // 若當前 graph 已是正確 key
    if (graph && graphState === "ok" && graphKeyRef.current === key)
      return graph;

    // cache 有就直接用
    const cached = graphCacheRef.current.get(key);
    if (cached) {
      graphKeyRef.current = key;
      setGraph(cached);
      setGraphState("ok");
      setGraphErr("");
      return cached;
    }

    // 否則抓一次
    setGraphState("loading");
    setGraphErr("");
    setGraph(null);

    try {
      const g = await fetchGraphOrThrow({ seed, count, event: ev });
      graphCacheRef.current.set(key, g);
      graphKeyRef.current = key;
      setGraph(g);
      setGraphState("ok");
      return g;
    } catch (e: any) {
      setGraphState("error");
      setGraphErr(String(e?.message || e));
      return null;
    }
  }

  function graphReady() {
    const ev = activeEvent;
    if (!ev) return false;
    const key = makeGraphKey(ev.value, seed, count);
    return graphState === "ok" && !!graph && graphKeyRef.current === key;
  }

  // event 改變時，graph/sim/planner 都先回到比較安全的狀態
  useEffect(() => {
    setGraphState("idle");
    setGraphErr("");
    setGraph(null);
    graphKeyRef.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventValue]);

  // -------------------------
  // Simulator
  // -------------------------
  const sim = useSimulatorState();

  // graph/seed/count/event 變動時，模擬器最好不要誤用舊 cursor log
  useEffect(() => {
    sim.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventValue, seed, count]);

  // -------------------------
  // Planner
  // -------------------------
  const plannerWorker = usePlannerWorker(PlannerWorker);

  const [planState, setPlanState] = useState<LoadState>("idle");
  const [planErr, setPlanErr] = useState("");
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [showPlanRaw, setShowPlanRaw] = useState(false);

  const [resources, setResources] = useState<PlannerResources>({
    tickets: 10,
    platinum: 0,
    legend: 0,
    food: 3000,
    startPosId: "1A",
    maxExpansions: 200000,
  });

  // 資源改了就把舊結果清掉（避免誤解）
  useEffect(() => {
    setPlanState("idle");
    setPlanErr("");
    setPlanResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resources.tickets,
    resources.platinum,
    resources.legend,
    resources.food,
    resources.startPosId,
    resources.maxExpansions,
  ]);

  async function runPlanner() {
    // 目標貓至少 1
    if (!targetCatIds.length) {
      setPlanState("error");
      setPlanErr("請先在 Target Cats 勾選至少一隻目標貓");
      setPlanResult(null);
      return;
    }

    // ⭐未來需求(2)：按 planner 先自動呼叫 trackGraph
    const g = await ensureGraph();
    if (!g) {
      setPlanState("error");
      setPlanErr(graphErr || "TrackGraph 取得失敗");
      setPlanResult(null);
      return;
    }

    // 組 request
    const req = {
      graphs_by_event: { [g.event.value]: g },
      events: [{ event_value: g.event.value, pool_type: "normal" as const }], // 未來多 events 時這裡會擴充
      target_cats: targetCatIds,

      tickets: clampInt(resources.tickets, 0),
      platinum_tickets: clampInt(resources.platinum, 0),
      legend_tickets: clampInt(resources.legend, 0),
      food: clampInt(resources.food, 0),

      start_pos_id: (resources.startPosId || "1A").trim() || "1A",
      cfg: { max_expansions: clampInt(resources.maxExpansions, 1000) },
    };

    setPlanState("loading");
    setPlanErr("");
    setPlanResult(null);

    const resp: WorkerResp = await plannerWorker.run(req);

    if (resp.ok) {
      setPlanResult(resp.result);
      setPlanState("ok");
    } else {
      setPlanResult(null);
      setPlanState("error");
      setPlanErr(resp.error);
    }
  }

  // -------------------------
  // 回傳給 HomePage 組裝用
  // -------------------------
  return {
    // events
    eventsType,
    setEventsType,
    eventsState,
    events,
    eventsErr,
    reloadEvents,
    selectedEventValues,
    setSelectedEventValues,
    activeEventValue,

    // shared seed/count
    seed,
    setSeed,
    count,
    setCount,

    // target cats
    catsState,
    catsErr,
    catGroups,
    targetCatIds,
    setTargetCatIds,
    catNameById,

    // graph
    graphState,
    graphErr,
    graph,
    showGraphRaw,
    setShowGraphRaw,
    fetchGraphManual,
    graphReady,

    // simulator
    sim,

    // planner
    planState,
    planErr,
    planResult,
    showPlanRaw,
    setShowPlanRaw,
    resources,
    setResources,
    runPlanner,
  };
}
