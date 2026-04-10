import { createContext, useContext } from "react";
import type { LoadState } from "@/lib/loadState";
import type { PlannerStage, AppliedPlannerSession } from "../types";

export type SessionContextValue = {
  stage: PlannerStage;
  appliedSession: AppliedPlannerSession | null;
  planState: LoadState;
  planErr: string;
  runOverlayOpen: boolean;
  goToInputStage: () => void;
  cancelPlannerFlow: () => void;
  runPlannerFlow: () => Promise<void>;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function usePlannerSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("SessionContext is missing.");
  return ctx;
}
