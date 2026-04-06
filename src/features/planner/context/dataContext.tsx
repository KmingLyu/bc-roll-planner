import { createContext, useContext } from "react";
import type { Event } from "@/types/models";
import type { LoadState } from "@/lib/loadState";
import type { useEventCats } from "@/features/cats";

export type DataContextValue = {
  eventsState: LoadState;
  eventsErr: string;
  upcomingEvents: Event[];
  pastEvents: Event[];
  catsState: LoadState;
  catsErr: string;
  tierGroups: ReturnType<typeof useEventCats>["tierGroups"];
  catNameById: Map<number, string>;
};

export const DataContext = createContext<DataContextValue | null>(null);

export function usePlannerData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("DataContext is missing.");
  return ctx;
}
