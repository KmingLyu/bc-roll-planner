import { useMemo } from "react";
import { TargetCatsPicker } from "./TargetCatsPicker";
import { tierOrder } from "@/features/cats/types";
import type { TierGroup } from "@/features/cats/types";

type LoadState = "idle" | "loading" | "ok" | "error";

export function TargetCatsSelectionContent(props: {
  loadState: LoadState;
  error: string;
  groups: TierGroup[];
  selectedIds: number[];
  maxSelection: number;
  onChange: (next: number[]) => void;
  getCatHref?: (catId: number) => string | undefined;
  getCatImageUrl?: (catId: number) => string | undefined;
  query?: string;
  onQueryChange?: (value: string) => void;
  hideSearchInput?: boolean;
  minColWidth?: number;
  dense?: boolean;
}) {
  const {
    loadState,
    error,
    groups,
    selectedIds,
    maxSelection,
    onChange,
    getCatHref,
    getCatImageUrl,
    query,
    onQueryChange,
    hideSearchInput = false,
    minColWidth = 176,
    dense = true,
  } = props;

  const sortedGroups = useMemo(() => {
    const next = [...groups];
    next.sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier));
    return next;
  }, [groups]);

  return (
    <TargetCatsPicker
      loadState={loadState}
      error={error}
      groups={sortedGroups}
      selectedIds={selectedIds}
      maxSelection={maxSelection}
      onChange={onChange}
      getCatHref={getCatHref}
      getCatImageUrl={getCatImageUrl}
      query={query}
      onQueryChange={onQueryChange}
      hideSearchInput={hideSearchInput}
      minColWidth={minColWidth}
      dense={dense}
    />
  );
}
