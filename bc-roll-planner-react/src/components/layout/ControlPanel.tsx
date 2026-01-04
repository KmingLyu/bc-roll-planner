// src/components/layout/ControlPanel.tsx
export type UiFlags = {
  showControlPanel: boolean;

  showSeedCount: boolean;
  seedCountCollapsed: boolean;

  showEvents: boolean;
  eventsCollapsed: boolean;

  showTargetCats: boolean;
  targetCatsCollapsed: boolean;

  showPlanner: boolean;
  plannerCollapsed: boolean;

  showGraphDebug: boolean;
  graphDebugCollapsed: boolean;

  showSimulator: boolean;
  simulatorCollapsed: boolean;
};

export function ControlPanel(props: {
  value: UiFlags;
  onChange: (next: UiFlags) => void;
}) {
  const { value, onChange } = props;

  function set<K extends keyof UiFlags>(key: K, v: UiFlags[K]) {
    onChange({ ...value, [key]: v });
  }

  const rows: Array<{ key: keyof UiFlags; label: string }> = [
    { key: "showSeedCount", label: "顯示 Seed/Count" },
    { key: "showEvents", label: "顯示 Events" },
    { key: "showTargetCats", label: "顯示 Target Cats" },
    { key: "showPlanner", label: "顯示 Planner" },
    { key: "showGraphDebug", label: "顯示 Graph Debug" },
    { key: "showSimulator", label: "顯示 Simulator" },
  ];

  return (
    <div
      style={{
        border: "1px dashed #bbb",
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
        background: "#fafafa",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <div style={{ fontWeight: 800 }}>顯示設定（快速開關區塊）</div>
        <button onClick={() => set("showControlPanel", false)}>
          隱藏此面板
        </button>
      </div>

      <div
        style={{
          marginTop: 8,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 6,
        }}
      >
        {rows.map((r) => (
          <label
            key={String(r.key)}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(value[r.key])}
              onChange={(e) => set(r.key, e.target.checked as any)}
            />
            <span>{r.label}</span>
          </label>
        ))}
      </div>

      <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
        你也可以直接在 <code>PlannerPage.tsx</code> 的 <code>ui</code> state
        裡調整預設顯示/收合狀態。
      </div>
    </div>
  );
}
