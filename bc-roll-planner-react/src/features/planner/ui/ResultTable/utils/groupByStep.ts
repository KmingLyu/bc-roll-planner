import type { DrawRow } from "../../planViewModel";

export function groupByStep(rows: DrawRow[]): Array<[number, DrawRow[]]> {
  const byStep = new Map<number, DrawRow[]>();
  for (const r of rows) {
    const arr = byStep.get(r.stepIndex) ?? [];
    arr.push(r);
    byStep.set(r.stepIndex, arr);
  }
  return Array.from(byStep.entries()).sort((a, b) => a[0] - b[0]);
}
