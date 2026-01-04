// src/components/cats/TargetCatsPicker.tsx
import type { TierGroup } from "../../hooks/useEventCats";

type LoadState = "idle" | "loading" | "ok" | "error";

function tierLabel(tier: TierGroup["tier"]) {
  if (tier === "rare") return "Rare";
  if (tier === "super") return "Super";
  if (tier === "uber") return "Uber";
  return "Legendary";
}

export function TargetCatsPicker(props: {
  loadState: LoadState;
  error: string;
  groups: TierGroup[];
  selectedIds: number[];
  onChange: (next: number[]) => void;
  onClear: () => void;
  maxHeight?: number;
}) {
  const {
    loadState,
    error,
    groups,
    selectedIds,
    onChange,
    onClear,
    maxHeight = 320,
  } = props;

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
        <span>
          狀態：<b>{loadState}</b>
        </span>
        <span>
          已選：<b>{selectedIds.length}</b>
        </span>
        <button onClick={onClear} disabled={!selectedIds.length}>
          清空已選
        </button>
      </div>

      {loadState === "error" && (
        <div style={{ color: "crimson" }}>eventCats 錯誤：{error}</div>
      )}
      {loadState === "loading" && (
        <div style={{ opacity: 0.75 }}>載入貓咪列表中...</div>
      )}

      {loadState === "ok" && (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 10,
          }}
        >
          <div style={{ marginBottom: 8, opacity: 0.85, fontSize: 13 }}>
            目前為「選到的所有 events 的貓咪聯集」。未來多選 events
            時不用改這個元件。
          </div>

          {/* 內部卷軸 */}
          {/* <div style={{ maxHeight, overflow: "auto", paddingRight: 6 }}> */}
          <div style={{ paddingRight: 6 }}>
            <div style={{ display: "grid", gap: 12 }}>
              {groups.map((g) => (
                <div
                  key={g.tier}
                  style={{
                    border: "1px solid #f0f0f0",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
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
                      const checked = selectedIds.includes(c.id);
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
                              onChange(
                                on
                                  ? [...selectedIds, c.id]
                                  : selectedIds.filter((x) => x !== c.id)
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

              {!groups.length && (
                <div style={{ opacity: 0.75 }}>
                  解析不到貓咪列表（eventCats 回傳可能為空）
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
