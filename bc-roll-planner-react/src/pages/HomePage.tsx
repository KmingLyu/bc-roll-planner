import { useEffect, useMemo, useState } from "react";

// Models
import type { Event, TrackGraph } from "../../shared/models";

// APIs
import { fetchEvents } from "../api/eventsApi";
import { fetchTrackGraph } from "../api/trackGraphApi";
import { ApiError } from "../api/netlifyClient";

// Core
import type { DrawRecord } from "../core/simulator";
import { simulateOnGraph } from "../core/simulator";

type LoadState = "idle" | "loading" | "ok" | "error";

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

export default function HomePage() {
  // --- events ---
  const [eventsType, setEventsType] = useState<"upcoming" | "past">("upcoming");
  const [eventsState, setEventsState] = useState<LoadState>("idle");
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsErr, setEventsErr] = useState<string>("");

  // --- form ---
  const [seed, setSeed] = useState("1234");
  const [count, setCount] = useState(120);
  const [selectedEventValue, setSelectedEventValue] = useState<string>("");

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.value === selectedEventValue) || null;
  }, [events, selectedEventValue]);

  // --- graph ---
  const [graphState, setGraphState] = useState<LoadState>("idle");
  const [graph, setGraph] = useState<TrackGraph | null>(null);
  const [graphErr, setGraphErr] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);

  // --- simulator ---
  const [simCursorId, setSimCursorId] = useState<string>("1A");
  const [simPrevCatId, setSimPrevCatId] = useState<number | null>(null);
  const [simRecords, setSimRecords] = useState<DrawRecord[]>([]);
  const [simText, setSimText] = useState<string>("");

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

  const nodesCount = useMemo(() => {
    return graph ? Object.keys(graph.nodes || {}).length : 0;
  }, [graph]);

  const cat1A = useMemo(() => getNormalCatName(graph, "1A"), [graph]);
  const cat1B = useMemo(() => getNormalCatName(graph, "1B"), [graph]);

  // --- simulator ---
  function graphReady(): boolean {
    return graphState === "ok" && !!graph;
  }

  function resetSim() {
    setSimCursorId("1A");
    setSimPrevCatId(null);
    setSimRecords([]);
    setSimText(""); // 你本來就有 simText
  }

  function appendSim(method: "single" | "ten") {
    if (!graphReady() || !graph) {
      setSimText("請先成功取得 TrackGraph（按『呼叫 trackGraph』）");
      return;
    }

    try {
      // 用 simulator 跑「一次動作」，起點用目前 simCursorId
      const { records, final_cursor } = simulateOnGraph({
        graph,
        actions: [{ event_value: graph.event.value, method }],
        start_pos_id: simCursorId,
      });

      // 更新 prevCatId：最後一筆 records 的 cat_id（含保底第11隻）
      const last = records.length ? records[records.length - 1] : null;
      const nextPrevCatId = last?.cat_id ?? null;

      // 讓 step 連續累加（simulateOnGraph 每次都從 step=1 開始）
      const baseStep = simRecords.length;
      const rebased = records.map((r) => ({
        ...r,
        step: r.step + baseStep,
      }));

      const nextAll = [...simRecords, ...rebased];

      setSimRecords(nextAll);
      setSimCursorId(final_cursor.id);
      setSimPrevCatId(nextPrevCatId);

      // 你原本的 simText：這裡直接用簡單摘要（也可以改成 table）
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

  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <h2>BC Roll Planner v1（API smoke test）</h2>

      {/* Events */}
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

      {/* TrackGraph */}
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

      {/* Simulator Controls (放在 TrackGraph 下面) */}
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

        {/* 文字輸出（你原本的 simText 直接沿用） */}
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
