import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { TierGroup } from "@/features/cats/types";
import { CatSelectableItem } from "./CatSelectableItem";

import type { LoadState } from "@/lib/loadState";

import { describeSelectionCapacity } from "@/lib/selection";

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
  maxSelection: number;
  onChange: (next: number[]) => void;
  query?: string;
  onQueryChange?: (value: string) => void;
  hideSearchInput?: boolean;
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
    maxSelection,
    onChange,
    query,
    onQueryChange,
    hideSearchInput = false,
    minColWidth = 176,
    dense = true,
    getCatHref,
    getCatImageUrl,
    renderCatSecondary,
  } = props;

  const [internalQuery, setInternalQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const queryValue = query ?? internalQuery;
  const deferredQuery = useDeferredValue(queryValue);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const atSelectionLimit = selectedIds.length >= maxSelection;
  const selectionSummary = describeSelectionCapacity({
    count: selectedIds.length,
    limit: maxSelection,
    unit: "隻目標貓咪",
  });

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
      if (selectedIds.includes(id)) {
        onChange(selectedIds);
        return;
      }
      if (selectedIds.length >= maxSelection) {
        return;
      }
      onChange([...selectedIds, id]);
      return;
    }
    onChange(selectedIds.filter((value) => value !== id));
  }

  function handleQueryChange(value: string) {
    if (onQueryChange) {
      onQueryChange(value);
      return;
    }
    setInternalQuery(value);
  }

  return (
    <div className="space-y-3">
      {!hideSearchInput ? (
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="target-cat-search"
            autoComplete="off"
            value={queryValue}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="搜尋目標貓咪"
            className="workspace-search pl-11"
          />
        </div>
      ) : null}

      {loadState === "loading" ? (
        <div className="text-sm text-muted-foreground">正在載入貓池…</div>
      ) : null}
      {loadState === "error" ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : null}
      {atSelectionLimit ? (
        <Alert variant="warning">
          已選滿 {maxSelection} 隻目標貓咪，先取消既有目標後才能再新增。
        </Alert>
      ) : (
        <div className="px-1 text-xs text-muted-foreground">
          {selectionSummary}
        </div>
      )}

      <div className="space-y-0.5">
        {filteredGroups.length ? (
          filteredGroups.map((group, index) => (
            <section
              key={group.tier}
              className={index > 0 ? "pt-2.5" : ""}
            >
              <div className="sticky top-0 z-10 -mx-5 mb-1 flex items-center gap-2 border-b border-border/45 bg-card/95 px-5 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/85">
                <span className="text-sm font-semibold text-foreground">
                  {tierLabel(group.tier)}
                </span>
                <Badge variant="muted">{group.cats.length}</Badge>
              </div>
              <div className="pt-0.5">
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minColWidth}px), 1fr))`,
                  }}
                >
                  {group.cats.map((cat) => (
                    <CatSelectableItem
                      key={cat.id}
                      catId={cat.id}
                      name={cat.name}
                      checked={selectedSet.has(cat.id)}
                      disabled={atSelectionLimit && !selectedSet.has(cat.id)}
                      onToggle={(checked) => toggle(cat.id, checked)}
                      imageUrl={getCatImageUrl?.(cat.id)}
                      href={getCatHref?.(cat.id)}
                      dense={dense}
                      secondary={renderCatSecondary?.(cat.id)}
                    />
                  ))}
                </div>
              </div>
            </section>
          ))
        ) : (
          groups.length ? (
            <div className="space-y-1 py-2">
              <div className="text-sm text-muted-foreground">
                沒有符合搜尋條件的貓咪。
              </div>
              {atSelectionLimit ? (
                <div className="text-xs font-medium text-warning">
                  已達上限時，仍可搜尋並取消目前已選的目標貓咪。
                </div>
              ) : null}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
