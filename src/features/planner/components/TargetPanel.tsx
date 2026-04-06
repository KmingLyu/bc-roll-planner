import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { TargetCatsSelectionContent } from "@/features/cats";
import {
  buildGodfatCatHref,
  buildGodfatCatImageUrl,
} from "@/features/cats/urls";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BC_ENV } from "@/config/env";
import { MAX_SELECTED_TARGET_CATS } from "../logic/helpers";
import { usePlannerScreen } from "../PlannerPageContainer";
import { CatChip } from "./CatChip";

export function TargetPanel() {
  const {
    catsState,
    catsErr,
    tierGroups,
    catNameById,
    draft,
    setTargetCatIds,
    clearTargetCatIds,
  } = usePlannerScreen();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [catQuery, setCatQuery] = useState("");

  const selectedCats = useMemo(() => {
    const namesFromGroups = new Map<number, string>();
    for (const group of tierGroups) {
      for (const cat of group.cats) {
        namesFromGroups.set(cat.id, cat.name);
      }
    }

    return draft.targetCatIds.map((catId) => ({
      id: catId,
      name:
        namesFromGroups.get(catId) ??
        catNameById.get(catId) ??
        `貓咪 #${catId}`,
    }));
  }, [catNameById, draft.targetCatIds, tierGroups]);
  const visibleSelectedCats = selectedCats.slice(0, MAX_SELECTED_TARGET_CATS);
  const hiddenSelectedCatCount = Math.max(
    0,
    selectedCats.length - visibleSelectedCats.length,
  );
  const atSelectionLimit =
    draft.targetCatIds.length >= MAX_SELECTED_TARGET_CATS;
  const selectionSummary = atSelectionLimit
    ? `已達上限 ${MAX_SELECTED_TARGET_CATS} 隻，取消已選貓咪後才能更換。`
    : draft.targetCatIds.length === 0
      ? `最多可選 ${MAX_SELECTED_TARGET_CATS} 隻目標貓咪。`
      : `還可再選 ${MAX_SELECTED_TARGET_CATS - draft.targetCatIds.length} 隻目標貓咪。`;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-foreground">
            選擇目標貓咪
          </div>
          <Badge variant={atSelectionLimit ? "warning" : "muted"}>
            {draft.targetCatIds.length}/{MAX_SELECTED_TARGET_CATS}
          </Badge>
          {draft.targetCatIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-auto rounded-none border-l border-border/55 px-0 pl-3 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={clearTargetCatIds}
            >
              清空
            </Button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="group block w-full rounded-2xl border border-border/55 bg-background px-4 py-3 text-left transition-colors hover:border-border hover:bg-muted/[0.04] active:bg-muted/[0.08]"
      >
        {selectedCats.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {visibleSelectedCats.map((cat) => (
              <CatChip
                key={cat.id}
                catId={cat.id}
                name={cat.name}
                getCatImageUrl={(catId) =>
                  buildGodfatCatImageUrl(catId, { lang: BC_ENV.lang })
                }
              />
            ))}
            {hiddenSelectedCatCount > 0 ? (
              <div className="inline-flex items-center rounded-full bg-muted/24 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                +{hiddenSelectedCatCount} 隻已選貓咪
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-2 text-sm text-muted-foreground">
            點擊選擇目標貓咪
          </div>
        )}
      </button>
      <div
        className={cn(
          "px-1 text-xs",
          atSelectionLimit
            ? "font-medium text-warning"
            : "text-muted-foreground",
        )}
      >
        {selectionSummary}
      </div>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={(nextOpen) => {
          setSheetOpen(nextOpen);
          if (!nextOpen) setCatQuery("");
        }}
        title={`選擇目標貓咪 (${draft.targetCatIds.length}/${MAX_SELECTED_TARGET_CATS})`}
        toolbar={
          <div className="flex items-center gap-4">
            <div className="w-20 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearTargetCatIds}
                className={cn(
                  "h-auto w-full shrink-0 justify-end px-0 pr-2 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground",
                  draft.targetCatIds.length > 0 ? "visible" : "invisible",
                )}
                tabIndex={draft.targetCatIds.length > 0 ? 0 : -1}
                aria-hidden={draft.targetCatIds.length > 0 ? undefined : true}
              >
                清空
              </Button>
            </div>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="target-cat-search-header"
                autoComplete="off"
                value={catQuery}
                onChange={(event) => setCatQuery(event.target.value)}
                placeholder="搜尋目標貓咪"
                className="workspace-search pl-11"
              />
            </div>
          </div>
        }
      >
        <TargetCatsSelectionContent
          loadState={catsState}
          error={catsErr}
          groups={tierGroups}
          selectedIds={draft.targetCatIds}
          maxSelection={MAX_SELECTED_TARGET_CATS}
          onChange={setTargetCatIds}
          query={catQuery}
          onQueryChange={setCatQuery}
          hideSearchInput
          getCatHref={(catId) =>
            buildGodfatCatHref(catId, {
              lang: BC_ENV.lang,
              ui: BC_ENV.ui,
            })
          }
          getCatImageUrl={(catId) =>
            buildGodfatCatImageUrl(catId, { lang: BC_ENV.lang })
          }
          dense
        />
      </BottomSheet>
    </section>
  );
}
