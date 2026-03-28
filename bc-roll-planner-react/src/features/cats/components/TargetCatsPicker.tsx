import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TierGroup } from "@/features/cats/types";
import { cn } from "@/lib/utils";
import { CatSelectableItem } from "./CatSelectableItem";

type LoadState = "idle" | "loading" | "ok" | "error";

function tierLabel(tier: TierGroup["tier"]) {
  if (tier === "rare") return "Rare";
  if (tier === "super") return "Super";
  if (tier === "uber") return "Uber";
  return "Legendary";
}

function countBadgeClass(selectedCount: number) {
  return selectedCount
    ? "bg-primary/8 text-primary"
    : "bg-muted text-muted-foreground";
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
  const [openGroups, setOpenGroups] = useState<Partial<Record<TierGroup["tier"], boolean>>>({});
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
    <div className="space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_320px] sm:items-center">
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge className={countBadgeClass(selectedIds.length)} variant="muted">
            已選 {selectedIds.length}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={!selectedIds.length}
          >
            清空
          </Button>
        </div>
        <div className="relative w-full sm:w-[320px] sm:justify-self-end">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="target-cat-search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋目標貓咪"
            className="workspace-search pl-11"
          />
        </div>
      </div>

      {loadState === "loading" ? (
        <div className="text-sm text-muted-foreground">正在載入 event 貓池…</div>
      ) : null}
      {loadState === "error" ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : null}

      <div className="space-y-1">
        {filteredGroups.length ? (
          filteredGroups.map((group) => (
            <section
              key={group.tier}
              className="border-t border-border/45 pt-3 first:border-t-0 first:pt-0"
            >
              <button
                type="button"
                onClick={() =>
                  startTransition(() =>
                    setOpenGroups((current) => ({
                      ...current,
                      [group.tier]: !(
                        current[group.tier] ?? (normalizedQuery ? group.cats.length > 0 : false)
                      ),
                    })),
                  )
                }
                className="flex w-full items-center justify-between gap-3 py-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-foreground">
                    {tierLabel(group.tier)}
                  </div>
                  <Badge variant="muted">{group.cats.length}</Badge>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    (openGroups[group.tier] ?? (normalizedQuery ? group.cats.length > 0 : false)) &&
                      "rotate-180",
                  )}
                />
              </button>
              {openGroups[group.tier] ?? (normalizedQuery ? group.cats.length > 0 : false) ? (
                <div className="pt-2">
                  <div
                    className="grid gap-1.5"
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
              ) : null}
            </section>
          ))
        ) : (
          groups.length ? (
            <div className="py-2 text-sm text-muted-foreground">
              沒有符合搜尋條件的貓咪。
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
