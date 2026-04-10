import { createContext, useContext } from "react";
import type { PlannerDraftInputs, PlannerResources } from "../types";

export type DraftContextValue = {
  draft: PlannerDraftInputs;
  manualCountExpanded: boolean;
  setSeed: (value: string) => void;
  setCountInput: (value: string) => void;
  setResources: (next: PlannerResources) => void;
  setSelectedEventValues: (next: string[]) => void;
  setPrimaryEventValue: (value: string) => void;
  setTargetCatIds: (next: number[]) => void;
  clearTargetCatIds: () => void;
  toggleManualCount: () => void;
};

export const DraftContext = createContext<DraftContextValue | null>(null);

export function usePlannerDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("DraftContext is missing.");
  return ctx;
}
