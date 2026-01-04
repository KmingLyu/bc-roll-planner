// src/components/planner/PlannerRunBar.tsx
type LoadState = "idle" | "loading" | "ok" | "error";

export function PlannerRunBar(props: {
  state: LoadState;
  onRun: () => void;
  disabled: boolean;
  hint?: string;
}) {
  const { state, onRun, disabled, hint } = props;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <button onClick={onRun} disabled={disabled}>
        規劃（按下會先抓最新 TrackGraph）
      </button>

      <span>
        狀態：<b>{state}</b>
      </span>

      {hint && <span style={{ color: "#8a5a00" }}>{hint}</span>}
    </div>
  );
}
