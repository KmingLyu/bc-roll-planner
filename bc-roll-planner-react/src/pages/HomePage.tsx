// src/pages/HomePage.tsx
import { useEffect, useMemo, useRef, useState } from "react";

// Models
import type { Event, TrackGraph } from "../../shared/models";

// APIs
import { fetchEvents } from "../api/eventsApi";
import { fetchTrackGraph } from "../api/trackGraphApi";
import { fetchEventCats } from "../api/eventCatsApi";
import { ApiError } from "../api/netlifyClient";

// Simulator
import type { DrawRecord } from "../core/simulator";
import { simulateOnGraph } from "../core/simulator";

// Planner
import type { Cost, PlanResult } from "../core/planner";
import type { PlannerWorkerResponse } from "../workers/planner.worker";

type LoadState = "idle" | "loading" | "ok" | "error";
type WorkerResp = PlannerWorkerResponse;

const workerUrl = new URL("../workers/planner.worker.ts", import.meta.url);

type CatTier = "rare" | "super" | "uber" | "legendary";
type UiCat = { id: number; name: string; tier?: CatTier };
type TierGroup = { tier: CatTier; cats: UiCat[] };

// -------------------------
// Utils
// -------------------------
function safeJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function getNormalCatName(g: TrackGraph | null, posId: string): string {
  const node = g?.nodes?.[posId];
  const cat = node?.edges?.normal?.cat;
  return cat?.name || "-";
}

function tierLabel(t: CatTier): string {
  if (t === "rare") return "Rare";
  if (t === "super") return "Super";
  if (t === "uber") return "Uber";
  return "Legendary";
}

function tierOrder(t: CatTier): number {
  // 依你提供的 find_select 排序：Legendary > Uber > Super > Rare
  if (t === "legendary") return 0;
  if (t === "uber") return 1;
  if (t === "super") return 2;
  return 3;
}

function fmtCost(cost: Cost | number[] | null | undefined): string {
  if (!cost || !Array.isArray(cost)) return "-";
  const [equiv, foodUsed, tUsed, pUsed, lUsed] = cost as any;
  return `equiv=${equiv}, food=${foodUsed}, ticket=${tUsed}, platinum=${pUsed}, legend=${lUsed}`;
}

// -------------------------
// Component
// -------------------------
export default function HomePage() {
  // -------------------------
  // Form (seed/count/event)
  // -------------------------
  const [seed, setSeed] = useState("1234");
  const [count, setCount] = useState(120);
  const [selectedEventValue, setSelectedEventValue] = useState<string>("");

  // -------------------------
  // Events
  // -------------------------
  const [eventsType, setEventsType] = useState<"upcoming" | "past">("upcoming");
  const [eventsState, setEventsState] = useState<LoadState>("idle");
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsErr, setEventsErr] = useState<string>("");

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.value === selectedEventValue) || null;
  }, [events, selectedEventValue]);

  // -------------------------
  // EventCats (Target Cats)
  // -------------------------
  const [catsState, setCatsState] = useState<LoadState>("idle");
  const [catsErr, setCatsErr] = useState<string>("");
  const [catGroups, setCatGroups] = useState<TierGroup[]>([]);
  const [targetCatIds, setTargetCatIds] = useState<number[]>([]);

  // 目標貓 id -> 名字（從 eventCats 的 catGroups 反查）
  const catNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of catGroups) for (const c of g.cats) m.set(c.id, c.name);
    return m;
  }, [catGroups]);

  // -------------------------
  // TrackGraph
  // -------------------------
  const [graphState, setGraphState] = useState<LoadState>("idle");
  const [graph, setGraph] = useState<TrackGraph | null>(null);
  const [graphErr, setGraphErr] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);

  const nodesCount = useMemo(() => {
    return graph ? Object.keys(graph.nodes || {}).length : 0;
  }, [graph]);

  const cat1A = useMemo(() => getNormalCatName(graph, "1A"), [graph]);
  const cat1B = useMemo(() => getNormalCatName(graph, "1B"), [graph]);

  // -------------------------
  // Simulator
  // -------------------------
  const [simCursorId, setSimCursorId] = useState<string>("1A");
  const [simPrevCatId, setSimPrevCatId] = useState<number | null>(null);
  const [simRecords, setSimRecords] = useState<DrawRecord[]>([]);
  const [simText, setSimText] = useState<string>("");

  function graphReady(): boolean {
    return graphState === "ok" && !!graph;
  }

  function resetSim() {
    setSimCursorId("1A");
    setSimPrevCatId(null);
    setSimRecords([]);
    setSimText("");
  }

  function appendSim(method: "single" | "ten") {
    if (!graphReady() || !graph) {
      setSimText("請先成功取得 TrackGraph（按『呼叫 trackGraph』）");
      return;
    }

    try {
      const { records, final_cursor } = simulateOnGraph({
        graph,
        actions: [{ event_value: graph.event.value, method }],
        start_pos_id: simCursorId,
      });

      const last = records.length ? records[records.length - 1] : null;
      const nextPrevCatId = last?.cat_id ?? null;

      const baseStep = simRecords.length;
      const rebased = records.map((r) => ({
        ...r,
        step: r.step + baseStep,
      }));

      const nextAll = [...simRecords, ...rebased];

      setSimRecords(nextAll);
      setSimCursorId(final_cursor.id);
      setSimPrevCatId(nextPrevCatId);

      const lines = nextAll.map(
        (r) =>
          `${String(r.step).padStart(3, " ")} | ${r.method.padEnd(
            6
          )} | ${String(r.within_action_index).padStart(2, " ")} | ${
            r.from_pos_id
          } -> ${r.to_pos_id} | ${r.used} | ${r.cat_id ?? "-"} ${
            r.cat_name
          } | src=${r.source_pick_id ?? "-"}`
      );

      setSimText(
        [
          `cursor=${final_cursor.id}  prevCatId=${nextPrevCatId ?? "-"}`,
          `total_records=${nextAll.length}`,
          "",
          ...lines,
        ].join("\n")
      );
    } catch (e: any) {
      setSimText(`simulate failed: ${String(e?.message || e)}`);
    }
  }

  // -------------------------
  // Planner (Worker + Result)
  // -------------------------
  const workerRef = useRef<Worker | null>(null);

  const [planState, setPlanState] = useState<LoadState>("idle");
  const [planErr, setPlanErr] = useState<string>("");
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [showPlanRaw, setShowPlanRaw] = useState(false);
  const [planTickets, setPlanTickets] = useState<number>(10);
  const [planPlatinumTickets, setPlanPlatinumTickets] = useState<number>(0);
  const [planLegendTickets, setPlanLegendTickets] = useState<number>(0);
  const [planFood, setPlanFood] = useState<number>(3000);
  const [planStartPosId, setPlanStartPosId] = useState<string>("1A");
  const [planMaxExpansions, setPlanMaxExpansions] = useState<number>(200000);

  // 避免連點造成舊結果蓋掉新結果
  const planReqSeqRef = useRef(0);

  function ensurePlannerWorker() {
    if (!workerRef.current) {
      workerRef.current = new Worker(workerUrl, { type: "module" });
    }
    return workerRef.current;
  }

  function onRunPlanner() {
    if (!graph) return;

    if (!targetCatIds.length) {
      setPlanState("error");
      setPlanErr("請先在 Target Cats 勾選至少一隻目標貓");
      setPlanResult(null);
      return;
    }

    const w = ensurePlannerWorker();

    const req = {
      graphs_by_event: { [graph.event.value]: graph as TrackGraph },
      events: [
        { event_value: graph.event.value, pool_type: "normal" as const },
      ],
      target_cats: targetCatIds,

      tickets: Math.max(0, Math.floor(planTickets)),
      platinum_tickets: Math.max(0, Math.floor(planPlatinumTickets)),
      legend_tickets: Math.max(0, Math.floor(planLegendTickets)),
      food: Math.max(0, Math.floor(planFood)),

      start_pos_id: planStartPosId.trim() || "1A",
      cfg: { max_expansions: Math.max(1000, Math.floor(planMaxExpansions)) },
    };

    // 送出前先清狀態
    setPlanState("loading");
    setPlanErr("");
    setPlanResult(null);

    const seq = ++planReqSeqRef.current;

    w.onmessage = (e: MessageEvent<WorkerResp>) => {
      if (seq !== planReqSeqRef.current) return;

      if (e.data.ok) {
        setPlanResult(e.data.result);
        setPlanState("ok");
      } else {
        setPlanResult(null);
        setPlanState("error");
        setPlanErr(e.data.error);
      }
    };

    w.postMessage(req);
  }

  // -------------------------
  // Effects
  // -------------------------

  // Load events on mount or type change
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setEventsState("loading");
      setEventsErr("");
      try {
        const res = await fetchEvents({
          type: eventsType,
          limit: 60,
          lang: "tw",
          ui: "tw",
        });
        if (cancelled) return;

        setEvents(res.events || []);
        setEventsState("ok");

        // 預設自動選第一個（如果尚未選）
        if (!selectedEventValue && res.events?.[0]?.value) {
          setSelectedEventValue(res.events[0].value);
        }
      } catch (e: any) {
        if (cancelled) return;

        setEventsState("error");
        setEventsErr(
          e instanceof ApiError
            ? `${e.message} (HTTP ${e.status})`
            : String(e?.message || e)
        );
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsType]);

  // Auto load eventCats when seed/event/count changes
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const ev = selectedEventValue.trim();
      const s = seed.trim();
      const c = Number(count);

      if (!ev || !s || !Number.isFinite(c) || c <= 0) {
        setCatsState("idle");
        setCatsErr("");
        setCatGroups([]);
        // 不強制清空 targetCatIds（讓你可以先選好再改 seed/count）
        return;
      }

      setCatsState("loading");
      setCatsErr("");
      setCatGroups([]);

      try {
        const res = await fetchEventCats({
          seed: s,
          event: ev,
          count: c,
          lang: "tw",
          ui: "tw",
          name: selectedEvent?.name ?? ev,
          start_date: selectedEvent?.start_date ?? null,
          end_date: selectedEvent?.end_date ?? null,
        });

        if (cancelled) return;

        const groups = (res.groups || []) as TierGroup[];
        groups.sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier));

        setCatGroups(groups);
        setCatsState("ok");

        // 修剪：把已選但不在此 event 的 id 移除
        const allowed = new Set<number>();
        for (const g of groups) for (const cat of g.cats) allowed.add(cat.id);
        setTargetCatIds((prev) => prev.filter((id) => allowed.has(id)));
      } catch (e: any) {
        if (cancelled) return;

        setCatsState("error");
        setCatsErr(
          e instanceof ApiError
            ? `${e.message} (HTTP ${e.status})`
            : String(e?.message || e)
        );
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedEventValue, seed, count, selectedEvent]);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Reset plan result when resources change
  useEffect(() => {
    // 只要資源改了，就把舊結果清掉（避免誤解）
    setPlanState("idle");
    setPlanErr("");
    setPlanResult(null);
    // 不重置 worker，也不重置 target cats
  }, [
    planTickets,
    planPlatinumTickets,
    planLegendTickets,
    planFood,
    planStartPosId,
    planMaxExpansions,
  ]);

  // -------------------------
  // Actions
  // -------------------------
  async function onFetchGraph() {
    if (!seed.trim()) {
      setGraphErr("seed 不可為空");
      setGraphState("error");
      return;
    }
    if (!selectedEventValue.trim()) {
      setGraphErr("event 不可為空（請先載入 events 或手動輸入）");
      setGraphState("error");
      return;
    }
    if (!Number.isFinite(count) || count <= 0) {
      setGraphErr("count 必須是正整數");
      setGraphState("error");
      return;
    }

    setGraphState("loading");
    setGraphErr("");
    setGraph(null);

    try {
      const res = await fetchTrackGraph({
        seed: seed.trim(),
        event: selectedEventValue.trim(),
        count: Number(count),
        lang: "tw",
        ui: "tw",
        name: selectedEvent?.name ?? selectedEventValue,
        start_date: selectedEvent?.start_date ?? null,
        end_date: selectedEvent?.end_date ?? null,
      });

      setGraph(res.graph);
      setGraphState("ok");
    } catch (e: any) {
      setGraphState("error");
      setGraphErr(
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status})`
          : String(e?.message || e)
      );
    }
  }

  // -------------------------
  // Render
  // -------------------------
  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <h2>BC Roll Planner v1（API smoke test）</h2>

      {/* 1) Events */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>1) Events</h3>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label>
            類型：
            <select
              value={eventsType}
              onChange={(e) => setEventsType(e.target.value as any)}
              style={{ marginLeft: 8 }}
            >
              <option value="upcoming">upcoming</option>
              <option value="past">past</option>
            </select>
          </label>

          <button
            onClick={() =>
              setEventsType((t) => (t === "upcoming" ? "past" : "upcoming"))
            }
          >
            切換並重抓
          </button>

          <span>
            狀態：<b>{eventsState}</b>
          </span>

          <span>筆數：{events.length}</span>
        </div>

        {eventsState === "error" && (
          <div style={{ marginTop: 8, color: "crimson" }}>
            events 錯誤：{eventsErr}
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            選擇 event：
          </label>
          <select
            value={selectedEventValue}
            onChange={(e) => setSelectedEventValue(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            {events.map((e) => (
              <option key={e.value} value={e.value}>
                {e.value} — {e.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* 1.5) Target Cats */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>1.5) Target Cats (eventCats)</h3>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span>
            狀態：<b>{catsState}</b>
          </span>
          <span>
            已選：<b>{targetCatIds.length}</b>
          </span>
          <button
            onClick={() => setTargetCatIds([])}
            disabled={!targetCatIds.length}
          >
            清空已選
          </button>
        </div>

        {catsState === "error" && (
          <div style={{ marginTop: 8, color: "crimson" }}>
            eventCats 錯誤：{catsErr}
          </div>
        )}

        {catsState === "loading" && (
          <div style={{ marginTop: 8, opacity: 0.7 }}>載入貓咪列表中...</div>
        )}

        {catsState === "ok" && (
          <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
            {catGroups.map((g) => (
              <div
                key={g.tier}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  {tierLabel(g.tier)}（{g.cats.length}）
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 6,
                  }}
                >
                  {g.cats.map((c) => {
                    const checked = targetCatIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setTargetCatIds((prev) =>
                              on
                                ? [...prev, c.id]
                                : prev.filter((x) => x !== c.id)
                            );
                          }}
                        />
                        <span>{c.name}</span>
                        <span style={{ opacity: 0.6 }}>#{c.id}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {!catGroups.length && (
              <div style={{ opacity: 0.7 }}>
                這個 event 解析不到貓咪列表（請檢查 eventCats 回傳的 source
                是否為 none）
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2) TrackGraph */}
      <section
        style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
      >
        <h3 style={{ marginTop: 0 }}>2) TrackGraph</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr",
            gap: 10,
            maxWidth: 640,
          }}
        >
          <div>seed</div>
          <input value={seed} onChange={(e) => setSeed(e.target.value)} />

          <div>count</div>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            min={1}
          />

          <div>event</div>
          <input
            value={selectedEventValue}
            onChange={(e) => setSelectedEventValue(e.target.value)}
            placeholder="可用下拉選，或手動貼上 event value"
          />
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button onClick={onFetchGraph}>呼叫 trackGraph</button>

          <span>
            狀態：<b>{graphState}</b>
          </span>

          <label
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={showRaw}
              onChange={(e) => setShowRaw(e.target.checked)}
            />
            顯示 raw JSON
          </label>
        </div>

        {graphState === "error" && (
          <div style={{ marginTop: 8, color: "crimson" }}>
            trackGraph 錯誤：{graphErr}
          </div>
        )}

        {graphState === "ok" && graph && (
          <div style={{ marginTop: 10 }}>
            <div>
              <b>nodes count</b>：{nodesCount}
            </div>
            <div>
              <b>1A normal</b>：{cat1A}
            </div>
            <div>
              <b>1B normal</b>：{cat1B}
            </div>

            {showRaw && (
              <pre
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: "#f7f7f7",
                  overflow: "auto",
                }}
              >
                {safeJson(graph)}
              </pre>
            )}
          </div>
        )}
      </section>

      {/* 2.5) Planner Result */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          marginTop: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>2.5) Planner Result</h3>

        {/* Planner resources */}
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "140px 1fr",
            gap: 10,
            maxWidth: 520,
          }}
        >
          <div>tickets</div>
          <input
            type="number"
            min={0}
            value={planTickets}
            onChange={(e) => setPlanTickets(Number(e.target.value))}
          />

          <div>platinum</div>
          <input
            type="number"
            min={0}
            value={planPlatinumTickets}
            onChange={(e) => setPlanPlatinumTickets(Number(e.target.value))}
          />

          <div>legend</div>
          <input
            type="number"
            min={0}
            value={planLegendTickets}
            onChange={(e) => setPlanLegendTickets(Number(e.target.value))}
          />

          <div>food</div>
          <input
            type="number"
            min={0}
            step={100}
            value={planFood}
            onChange={(e) => setPlanFood(Number(e.target.value))}
          />

          <div>start_pos_id</div>
          <input
            value={planStartPosId}
            onChange={(e) => setPlanStartPosId(e.target.value)}
            placeholder="例如 1A"
          />

          <div>max_expansions</div>
          <input
            type="number"
            min={1000}
            step={1000}
            value={planMaxExpansions}
            onChange={(e) => setPlanMaxExpansions(Number(e.target.value))}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span>
            狀態：<b>{planState}</b>
          </span>

          <button
            onClick={onRunPlanner}
            disabled={!graph || graphState !== "ok" || planState === "loading"}
          >
            規劃（planner）
          </button>

          <label
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={showPlanRaw}
              onChange={(e) => setShowPlanRaw(e.target.checked)}
            />
            顯示 raw JSON
          </label>
        </div>

        {planState === "error" && (
          <div style={{ marginTop: 8, color: "crimson" }}>
            planner 錯誤：{planErr}
          </div>
        )}

        {planState === "loading" && (
          <div style={{ marginTop: 8, opacity: 0.7 }}>規劃中...</div>
        )}

        {planState === "ok" && planResult && (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {/* Summary */}
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 10,
                display: "grid",
                gap: 6,
              }}
            >
              <div>
                結果：
                <b
                  style={{
                    marginLeft: 8,
                    color: planResult.success ? "green" : "crimson",
                  }}
                >
                  {planResult.success
                    ? "成功（命中全部目標）"
                    : "未完全命中（顯示目前最佳部分解）"}
                </b>
              </div>

              <div>
                命中：<b>{planResult.targets_hit}</b> /{" "}
                {planResult.targets_total}
                {planResult.targets_missing_ids?.length ? (
                  <span style={{ marginLeft: 10, opacity: 0.9 }}>
                    缺少：
                    {planResult.targets_missing_ids
                      .slice(0, 12)
                      .map((id) => `${catNameById.get(id) ?? "?"}#${id}`)
                      .join(", ")}
                    {planResult.targets_missing_ids.length > 12 ? " ..." : ""}
                  </span>
                ) : null}
              </div>

              <div>
                最終位置：<b>{planResult.final_cursor_id}</b>{" "}
                <span style={{ opacity: 0.8 }}>
                  (prevCatId={planResult.final_prev_cat_id ?? "-"})
                </span>
              </div>

              <div>
                花費：<b>{fmtCost(planResult.total_cost)}</b>
              </div>

              <div style={{ opacity: 0.85 }}>
                steps={planResult.plan?.length ?? 0}, draws=
                {planResult.all_draws?.length ?? 0}
              </div>
            </div>

            {/* Steps table */}
            <div
              style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Plan Steps</div>

              {!planResult.plan?.length ? (
                <div style={{ opacity: 0.7 }}>
                  沒有 step（可能資源不足或 graph 無法走位）
                </div>
              ) : (
                <div style={{ overflow: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>
                        {[
                          "#",
                          "event",
                          "resource",
                          "method",
                          "from→to",
                          "cost_inc",
                          "draws",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              borderBottom: "1px solid #ddd",
                              padding: "6px 6px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {planResult.plan.map((st, i) => {
                        const draws = st.draws || [];
                        const drawsText =
                          draws
                            .map((d) =>
                              d.cat_id != null
                                ? `${d.cat_name}#${d.cat_id}`
                                : "-"
                            )
                            .slice(0, 8)
                            .join(", ") + (draws.length > 8 ? " ..." : "");

                        return (
                          <tr
                            key={`${i}-${st.event_value}-${st.start_cursor_id}`}
                          >
                            <td
                              style={{
                                padding: "6px 6px",
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              {i + 1}
                            </td>

                            <td
                              style={{
                                padding: "6px 6px",
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              {st.event_value}
                            </td>

                            <td
                              style={{
                                padding: "6px 6px",
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              {st.resource}
                            </td>

                            <td
                              style={{
                                padding: "6px 6px",
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              {st.method}
                            </td>

                            <td
                              style={{
                                padding: "6px 6px",
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              {st.start_cursor_id} → {st.end_cursor_id}
                            </td>

                            <td
                              style={{
                                padding: "6px 6px",
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              {fmtCost(st.cost_inc as any)}
                            </td>

                            <td
                              style={{
                                padding: "6px 6px",
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              {drawsText || "-"}
                              <details style={{ marginTop: 6 }}>
                                <summary style={{ cursor: "pointer" }}>
                                  展開（{draws.length} draws）
                                </summary>

                                <div
                                  style={{
                                    marginTop: 6,
                                    display: "grid",
                                    gap: 4,
                                  }}
                                >
                                  {draws.map((d, idx) => (
                                    <div
                                      key={`${i}-${idx}-${d.from_pos_id}-${
                                        d.cat_id ?? "x"
                                      }`}
                                      style={{
                                        fontFamily:
                                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                                      }}
                                    >
                                      {String(idx + 1).padStart(2, "0")}.{" "}
                                      {d.used.padEnd(12)} {d.from_pos_id}→
                                      {d.to_pos_id} {d.cat_id ?? "-"}{" "}
                                      {d.cat_name}{" "}
                                      <span style={{ opacity: 0.65 }}>
                                        (src={d.source_pick_id ?? "-"})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Raw JSON */}
            {showPlanRaw && (
              <pre
                style={{
                  marginTop: 0,
                  padding: 10,
                  background: "#f7f7f7",
                  overflow: "auto",
                  borderRadius: 8,
                }}
              >
                {safeJson(planResult)}
              </pre>
            )}
          </div>
        )}
      </section>

      {/* 3) Simulator */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          marginTop: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>3) Simulator</h3>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => appendSim("single")}
            disabled={!graph || graphState !== "ok"}
          >
            單抽一次
          </button>

          <button
            onClick={() => appendSim("ten")}
            disabled={!graph || graphState !== "ok"}
          >
            十連一次
          </button>

          <button onClick={resetSim}>重設（回到 1A）</button>

          <span>
            cursor：<b>{simCursorId}</b>
          </span>

          <span>
            prevCatId：<b>{simPrevCatId ?? "-"}</b>
          </span>

          <span>
            records：<b>{simRecords.length}</b>
          </span>
        </div>

        {simText && (
          <pre
            style={{
              marginTop: 10,
              padding: 10,
              background: "#f7f7f7",
              overflow: "auto",
            }}
          >
            {simText}
          </pre>
        )}
      </section>
    </div>
  );
}
