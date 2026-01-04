// src/components/inputs/SeedCountForm.tsx
import { useRef, useState } from "react";

export function SeedCountForm(props: {
  seedApplied: string;
  countApplied: number;
  onApply: (v: { seed: string; count: number }) => void;
}) {
  const { seedApplied, countApplied, onApply } = props;

  // 使用 local state（只在此 component 內更新，不影響全域）
  const [seedDraft, setSeedDraft] = useState(seedApplied);
  const [countDraft, setCountDraft] = useState<number>(countApplied);

  const errRef = useRef<string>("");

  function apply() {
    const s = seedDraft.trim();
    const c = Number(countDraft);
    if (!s) {
      errRef.current = "seed 不可為空";
      // 強迫刷新顯示
      setSeedDraft((x) => x);
      return;
    }
    if (!Number.isFinite(c) || c <= 0) {
      errRef.current = "count 必須是正整數";
      setCountDraft((x) => x);
      return;
    }
    errRef.current = "";
    onApply({ seed: s, count: Math.floor(c) });
  }

  const err = errRef.current;

  return (
    <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "140px 1fr",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div>seed</div>
        <input
          value={seedDraft}
          onChange={(e) => setSeedDraft(e.target.value)}
          placeholder="例如 1234"
        />

        <div>count</div>
        <input
          type="number"
          min={1}
          value={countDraft}
          onChange={(e) => setCountDraft(Number(e.target.value))}
        />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={apply} style={{ cursor: "pointer" }}>
          套用（Apply）
        </button>

        <button
          onClick={() => {
            setSeedDraft(seedApplied);
            setCountDraft(countApplied);
            errRef.current = "";
          }}
          style={{ cursor: "pointer" }}
        >
          還原為已套用值
        </button>

        <span style={{ opacity: 0.75, fontSize: 13 }}>
          ※ 輸入不會觸發後續載入，只有按 Apply 才會更新
        </span>
      </div>

      {err && <div style={{ color: "crimson" }}>{err}</div>}
    </div>
  );
}
