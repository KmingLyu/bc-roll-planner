import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TierGroup } from "@/features/cats/types";
import { CatSelectableItem } from "./CatSelectableItem";

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
  minColWidth?: number;
  dense?: boolean;
  getCatHref?: (catId: number) => string | undefined;
  getCatImageUrl?: (catId: number) => string | undefined;
  renderCatSecondary?: (catId: number) => React.ReactNode;
}) {
  const {
    loadState,
    error,
    groups,
    selectedIds,
    onChange,
    onClear,
    minColWidth = 220,
    dense = true,
    getCatHref,
    getCatImageUrl,
    renderCatSecondary,
  } = props;

  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return groups;
    return groups
      .map((group) => ({
        ...group,
        cats: group.cats.filter((cat) =>
          cat.name.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.cats.length);
  }, [groups, normalizedQuery]);

  function toggle(id: number, checked: boolean) {
    if (checked) {
      onChange(selectedIds.includes(id) ? selectedIds : [...selectedIds, id]);
      return;
    }
    onChange(selectedIds.filter((value) => value !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">目標貓咪</div>
          <div className="text-sm text-muted-foreground">
            這裡是目前所有已選 event 的貓咪聯集。
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={selectedIds.length ? "default" : "muted"}>
            已選 {selectedIds.length}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={onClear}
            disabled={!selectedIds.length}
          >
            清空
          </Button>
        </div>
      </div>

      <Input
        name="target-cat-search"
        autoComplete="off"
        value={query}
        onChange={(event) =>
          startTransition(() => setQuery(event.target.value))
        }
        placeholder="搜尋目標貓咪"
      />

      {loadState === "loading" ? <Alert variant="info">正在載入 event 貓池…</Alert> : null}
      {loadState === "error" ? <Alert variant="error">{error}</Alert> : null}

      <div className="space-y-4">
        {filteredGroups.length ? (
          filteredGroups.map((group) => (
            <details
              key={group.tier}
              className="section-surface overflow-hidden"
              open={group.tier === "legendary" || group.tier === "uber"}
            >
              <summary className="cursor-pointer list-none px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">
                    {tierLabel(group.tier)}
                  </div>
                  <Badge variant="outline">{group.cats.length}</Badge>
                </div>
              </summary>
              <div className="border-t border-border/70 px-5 py-5">
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(auto-fit, minmax(${minColWidth}px, 1fr))`,
                  }}
                >
                  {group.cats.map((cat) => (
                    <CatSelectableItem
                      key={cat.id}
                      catId={cat.id}
                      name={cat.name}
                      checked={selectedSet.has(cat.id)}
                      onToggle={(checked) => toggle(cat.id, checked)}
                      imageUrl={getCatImageUrl?.(cat.id)}
                      href={getCatHref?.(cat.id)}
                      dense={dense}
                      secondary={renderCatSecondary?.(cat.id)}
                    />
                  ))}
                </div>
              </div>
            </details>
          ))
        ) : (
          <Alert variant="warning">
            {groups.length ? "沒有符合搜尋條件的貓咪。" : "目前沒有可選的目標貓咪。"}
          </Alert>
        )}
      </div>
    </div>
  );
}
