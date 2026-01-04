// src/components/simulator/SimulatorPanel.tsx
import { useMemo, useState } from "react";
import type { TrackGraph } from "../../../shared/models";
import { simulateOnGraph, type DrawRecord } from "../../core/simulator";

export function SimulatorPanel(props: {
  graph: TrackGraph | null;
  graphReady: boolean;
}) {
  const { graph, graphReady } = props;

  const [cursorId, setCursorId] = useState<string>("1A");
  const [prevCatId, setPrevCatId] = useState<number | null>(null);
  const [records, setRecords] = useState<DrawRecord[]>([]);
  const [text, setText] = useState<string>("");

  const eventValue = useMemo(() => graph?.event?.value ?? "", [graph]);

  function reset() {
    setCursorId("1A");
    setPrevCatId(null);
    setRecords([]);
    setText("");
  }

  function append(method: "single" | "ten") {
    if (!graphReady || !graph) {
      setText("請先取得 TrackGraph（按 Planner 會自動抓）");
      return;
    }

    try {
      const { records: newRecs, final_cursor } = simulateOnGraph({
        graph,
        actions: [{ event_value: eventValue, method }],
        start_pos_id: cursorId,
      });

      const last = newRecs.length ? newRecs[newRecs.length - 1] : null;
      const nextPrev = last?.cat_id ?? null;

      const baseStep = records.length;
      const rebased = newRecs.map((r) => ({ ...r, step: r.step + baseStep }));
      const nextAll = [...records, ...rebased];

      setRecords(nextAll);
      setCursorId(final_cursor.id);
      setPrevCatId(nextPrev);

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

      setText(
        [
          `cursor=${final_cursor.id}  prevCatId=${nextPrev ?? "-"}`,
          `total_records=${nextAll.length}`,
          "",
          ...lines,
        ].join("\n")
      );
    } catch (e: any) {
      setText(`simulate failed: ${String(e?.message || e)}`);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => append("single")} disabled={!graphReady}>
          單抽一次
        </button>
        <button onClick={() => append("ten")} disabled={!graphReady}>
          十連一次
        </button>
        <button onClick={reset}>重設（回到 1A）</button>

        <span>
          cursor：<b>{cursorId}</b>
        </span>
        <span>
          prevCatId：<b>{prevCatId ?? "-"}</b>
        </span>
        <span>
          records：<b>{records.length}</b>
        </span>
      </div>

      {text && (
        <pre
          style={{
            margin: 0,
            padding: 10,
            background: "#f7f7f7",
            overflow: "auto",
            borderRadius: 10,
          }}
        >
          {text}
        </pre>
      )}
    </div>
  );
}
