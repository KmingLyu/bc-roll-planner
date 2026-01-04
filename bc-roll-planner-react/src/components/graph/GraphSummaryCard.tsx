// src/components/graph/GraphSummaryCard.tsx
import { useMemo, useState } from "react";
import type { TrackGraph } from "../../../shared/models";

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

export function GraphSummaryCard(props: {
  seedApplied: string;
  countApplied: number;
  selectedEventValue: string;

  graphState: LoadState;
  graphErr: string;
  graph: TrackGraph | null;
}) {
  const {
    seedApplied,
    countApplied,
    selectedEventValue,
    graphState,
    graphErr,
    graph,
  } = props;
  const [showRaw, setShowRaw] = useState(false);

  const nodesCount = useMemo(
    () => (graph ? Object.keys(graph.nodes || {}).length : 0),
    [graph]
  );
  const cat1A = useMemo(() => getNormalCatName(graph, "1A"), [graph]);
  const cat1B = useMemo(() => getNormalCatName(graph, "1B"), [graph]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ opacity: 0.85 }}>
        套用參數：seed=<b>{seedApplied}</b>，count=<b>{countApplied}</b>，event=
        <b>{selectedEventValue || "-"}</b>
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
          狀態：<b>{graphState}</b>
        </span>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={showRaw}
            onChange={(e) => setShowRaw(e.target.checked)}
          />
          顯示 raw JSON
        </label>
      </div>

      {graphState === "error" && (
        <div style={{ color: "crimson" }}>trackGraph 錯誤：{graphErr}</div>
      )}

      {graphState === "ok" && graph && (
        <div style={{ display: "grid", gap: 6 }}>
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
                margin: 0,
                padding: 10,
                background: "#f7f7f7",
                overflow: "auto",
                borderRadius: 10,
              }}
            >
              {safeJson(graph)}
            </pre>
          )}
        </div>
      )}

      {graphState === "idle" && (
        <div style={{ opacity: 0.7 }}>
          尚未抓取 TrackGraph（按 Planner 時會自動抓最新）
        </div>
      )}
      {graphState === "loading" && (
        <div style={{ opacity: 0.7 }}>TrackGraph 載入中...</div>
      )}
    </div>
  );
}
