import type { Cat, TrackGraph } from "@/types/models";
import { parsePosId } from "@/features/planner/logic/cursor";

export type StepUpGuaranteedInfo = {
  cursor_id: string;
  source_pick_id: string;
  cat: Cat;
  to_pos_id: string;
};

function parseTargetPos(posId: string): number | null {
  const match = /^(\d+)/.exec(String(posId || "").trim());
  if (!match) return null;
  const pos = Number(match[1]);
  return Number.isFinite(pos) ? pos : null;
}

function isNonStandardGuaranteedJump(cursorId: string, jumpTo: string): boolean {
  const from = parsePosId(cursorId);
  const toPos = parseTargetPos(jumpTo);
  if (toPos == null) return false;
  return toPos - from.pos !== 10;
}

export function getStepUpGuaranteedAt(
  graph: TrackGraph,
  cursorId: string,
): StepUpGuaranteedInfo | null {
  const baseCursorId = parsePosId(cursorId).id;
  const pickId = `${baseCursorId}G`;
  const cell = graph.raw_cells?.[pickId];
  const jumpTo = String(cell?.jump_to || "").trim();
  const cat = cell?.cat ?? null;

  if (!cat || !jumpTo) return null;
  if (!isNonStandardGuaranteedJump(baseCursorId, jumpTo)) return null;

  return {
    cursor_id: baseCursorId,
    source_pick_id: pickId,
    cat,
    to_pos_id: jumpTo,
  };
}

export function isStepUpPool(graph: TrackGraph): boolean {
  const cells = graph.raw_cells || {};
  for (const pickId of Object.keys(cells)) {
    const cell = cells[pickId];
    if (!cell || cell.suffix !== "") continue;
    if (getStepUpGuaranteedAt(graph, pickId)) return true;
  }
  return false;
}
