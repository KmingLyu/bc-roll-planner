import { useCallback, useState } from "react";
import type { TrackGraph } from "../../../shared/models";
import type { DrawRecord } from "../../core/simulator";
import { simulateOnGraph } from "../../core/simulator";

type Method = "single" | "ten";

export function useSimulatorState() {
  const [cursorId, setCursorId] = useState<string>("1A");
  const [prevCatId, setPrevCatId] = useState<number | null>(null);
  const [records, setRecords] = useState<DrawRecord[]>([]);
  const [text, setText] = useState<string>("");

  const reset = useCallback(() => {
    setCursorId("1A");
    setPrevCatId(null);
    setRecords([]);
    setText("");
  }, []);

  const append = useCallback(
    (method: Method, graph: TrackGraph) => {
      try {
        const { records: newRecords, final_cursor } = simulateOnGraph({
          graph,
          actions: [{ event_value: graph.event.value, method }],
          start_pos_id: cursorId,
        });

        const last = newRecords.length
          ? newRecords[newRecords.length - 1]
          : null;
        const nextPrevCatId = last?.cat_id ?? null;

        const baseStep = records.length;
        const rebased = newRecords.map((r) => ({
          ...r,
          step: r.step + baseStep,
        }));
        const nextAll = [...records, ...rebased];

        setRecords(nextAll);
        setCursorId(final_cursor.id);
        setPrevCatId(nextPrevCatId);

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
            `cursor=${final_cursor.id}  prevCatId=${nextPrevCatId ?? "-"}`,
            `total_records=${nextAll.length}`,
            "",
            ...lines,
          ].join("\n")
        );
      } catch (e: any) {
        setText(`simulate failed: ${String(e?.message || e)}`);
      }
    },
    [cursorId, records]
  );

  return { cursorId, prevCatId, records, text, reset, append };
}
