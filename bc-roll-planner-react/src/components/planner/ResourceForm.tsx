// src/components/planner/ResourceForm.tsx
export type PlannerResources = {
  tickets: number;
  platinum_tickets: number;
  legend_tickets: number;
  food: number;
};

export type PlannerConfig = {
  start_pos_id: string;
  max_expansions: number;
};

export function ResourceForm(props: {
  value: PlannerResources;
  cfg: PlannerConfig;
  onChange: (next: PlannerResources) => void;
  onCfgChange: (next: PlannerConfig) => void;
}) {
  const { value, cfg, onChange, onCfgChange } = props;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 800 }}>Planner 資源與設定</div>

      <div
        style={{
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
          value={value.tickets}
          onChange={(e) =>
            onChange({ ...value, tickets: Number(e.target.value) })
          }
        />

        <div>platinum</div>
        <input
          type="number"
          min={0}
          value={value.platinum_tickets}
          onChange={(e) =>
            onChange({ ...value, platinum_tickets: Number(e.target.value) })
          }
        />

        <div>legend</div>
        <input
          type="number"
          min={0}
          value={value.legend_tickets}
          onChange={(e) =>
            onChange({ ...value, legend_tickets: Number(e.target.value) })
          }
        />

        <div>food</div>
        <input
          type="number"
          min={0}
          step={100}
          value={value.food}
          onChange={(e) => onChange({ ...value, food: Number(e.target.value) })}
        />

        <div>start_pos_id</div>
        <input
          value={cfg.start_pos_id}
          onChange={(e) =>
            onCfgChange({ ...cfg, start_pos_id: e.target.value })
          }
          placeholder="例如 1A"
        />

        <div>max_expansions</div>
        <input
          type="number"
          min={1000}
          step={1000}
          value={cfg.max_expansions}
          onChange={(e) =>
            onCfgChange({ ...cfg, max_expansions: Number(e.target.value) })
          }
        />
      </div>
    </div>
  );
}
