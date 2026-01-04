// src/components/events/EventsPicker.tsx
import type { Event } from "../../../shared/models";

type LoadState = "idle" | "loading" | "ok" | "error";

export function EventsPicker(props: {
  mode: "upcoming" | "past";
  onModeChange: (m: "upcoming" | "past") => void;

  loadState: LoadState;
  error: string;
  events: Event[];

  value: string[]; // 先用 array，未來多選直接沿用
  onChange: (next: string[]) => void;
}) {
  const { mode, onModeChange, loadState, error, events, value, onChange } =
    props;

  const selected = value[0] ?? "";

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          類型：
          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as any)}
          >
            <option value="upcoming">upcoming</option>
            <option value="past">past</option>
          </select>
        </label>

        <button
          onClick={() =>
            onModeChange(mode === "upcoming" ? "past" : "upcoming")
          }
        >
          切換並重抓
        </button>

        <span>
          狀態：<b>{loadState}</b>
        </span>
        <span>筆數：{events.length}</span>
      </div>

      {loadState === "error" && (
        <div style={{ color: "crimson" }}>events 錯誤：{error}</div>
      )}

      <div>
        <div style={{ marginBottom: 6, fontWeight: 700 }}>
          選擇 event（目前單選）
        </div>
        <select
          value={selected}
          onChange={(e) => onChange([e.target.value])}
          style={{ width: "100%", padding: 8 }}
        >
          {events.map((ev) => (
            <option key={ev.value} value={ev.value}>
              {ev.value} — {ev.name}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
          未來多選：把這裡改成 checkbox list / multi-select，資料結構已經是{" "}
          <code>string[]</code>。
        </div>
      </div>
    </div>
  );
}
