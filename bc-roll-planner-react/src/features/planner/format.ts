import type { Cost } from "../../core/planner";

export function fmtCost(cost: Cost | number[] | null | undefined): string {
  if (!cost || !Array.isArray(cost)) return "-";
  const [equiv, foodUsed, tUsed, pUsed, lUsed] = cost as any;
  return `equiv=${equiv}, food=${foodUsed}, ticket=${tUsed}, platinum=${pUsed}, legend=${lUsed}`;
}
