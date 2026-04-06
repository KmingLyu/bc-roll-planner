import type { Event } from "@/types/models";
import type { PlannerDraftInputs, PlannerResources } from "../types";
import { parsePosId } from "./cursor";

export const MAX_SELECTED_EVENTS = 5;
export const MAX_SELECTED_TARGET_CATS = 20;
const AUTO_COUNT_PER_TEN_ROLL = 13;

export function clampNonNegativeInt(value: number): number {
  return Math.max(0, Math.floor(value || 0));
}

export function getStartPosOffset(startPosId: string): number {
  try {
    return Math.max(0, parsePosId((startPosId || "1A").trim() || "1A").pos - 1);
  } catch {
    return 0;
  }
}

export function estimateAutoCount(params: {
  selectedEventValues: string[];
  eventsByValue: Map<string, Event>;
  resources: PlannerResources;
  startPosId: string;
}) {
  const { selectedEventValues, eventsByValue, resources, startPosId } = params;

  if (!selectedEventValues.length) return 0;

  const poolTypes = new Set<string>();
  for (const eventValue of selectedEventValues) {
    poolTypes.add(eventsByValue.get(eventValue)?.pool_type ?? "normal");
  }

  const normalizedFood = clampNonNegativeInt(resources.food);
  const fullTenRollBundles = Math.floor(normalizedFood / 1500);
  const remainingFood = normalizedFood % 1500;
  const normalDepth = poolTypes.has("normal")
    ? clampNonNegativeInt(resources.tickets) +
      fullTenRollBundles * AUTO_COUNT_PER_TEN_ROLL +
      Math.floor(remainingFood / 150)
    : 0;
  const platinumDepth = poolTypes.has("platinum")
    ? clampNonNegativeInt(resources.platinum_tickets)
    : 0;
  const legendDepth = poolTypes.has("legend")
    ? clampNonNegativeInt(resources.legend_tickets)
    : 0;

  return (
    getStartPosOffset(startPosId) + normalDepth + platinumDepth + legendDepth
  );
}

export function parseManualCount(countInput: string): {
  manualCount: number | null;
  countError: string;
} {
  const trimmed = countInput.trim();
  if (!trimmed) return { manualCount: null, countError: "" };

  const next = Number(trimmed);
  if (!Number.isFinite(next) || !Number.isInteger(next) || next <= 0) {
    return { manualCount: null, countError: "count 必須是正整數" };
  }

  return { manualCount: next, countError: "" };
}

export function buildDraftSignature(draft: PlannerDraftInputs) {
  return JSON.stringify({
    seed: draft.seed.trim(),
    countInput: draft.countInput.trim(),
    resources: draft.resources,
    cfg: {
      start_pos_id: draft.cfg.start_pos_id.trim(),
      max_expansions: clampNonNegativeInt(draft.cfg.max_expansions),
    },
    selectedEventValues: [...draft.selectedEventValues].sort(),
    targetCatIds: [...draft.targetCatIds].sort((a, b) => a - b),
  });
}
