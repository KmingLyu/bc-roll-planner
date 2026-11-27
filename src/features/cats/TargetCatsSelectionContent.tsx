import { useMemo } from "react";
import { CatPicker } from "./CatPicker";
import { tierOrder } from "./types";
import type { TierGroup } from "./types";

import type { LoadState } from "@/lib/loadState";

export function TargetCatsSelectionContent(props: {
  loadState: LoadState;
  error: string;
  groups: TierGroup[];
  selectedIds: number[];
  maxSelection: number;
  onChange: (next: number[]) => void;
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
    <CatPicker
      loadState={loadState}
      error={error}
      groups={sortedGroups}
      selectedIds={selectedIds}
      maxSelection={maxSelection}
      onChange={onChange}
      getCatImageUrl={getCatImageUrl}
      query={query}
      onQueryChange={onQueryChange}
      hideSearchInput={hideSearchInput}
      minColWidth={minColWidth}
      dense={dense}
    />
  );
}
