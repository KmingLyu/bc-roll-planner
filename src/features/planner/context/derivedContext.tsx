import { createContext, useContext } from "react";

export type DerivedContextValue = {
  countError: string;
  manualCount: number | null;
  autoCount: number;
  resolvedCount: number;
  runDisabled: boolean;
  runHint: string;
};

export const DerivedContext = createContext<DerivedContextValue | null>(null);

export function usePlannerDerived() {
  const ctx = useContext(DerivedContext);
  if (!ctx) throw new Error("DerivedContext is missing.");
  return ctx;
}
