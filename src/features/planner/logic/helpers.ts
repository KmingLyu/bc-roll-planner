import type { Event } from "@/types/models";
import type { PlannerDraftInputs, PlannerResources } from "../types";
import { parsePosId } from "./cursor";

export const MAX_SELECTED_EVENTS = 5;
export const MAX_SELECTED_TARGET_CATS = 20;
const AUTO_COUNT_PER_TEN_ROLL = 13;

type StepUpPhaseIndex = 0 | 1 | 2;

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
  const canUseNormalFoodActions = poolTypes.has("normal");

  const foodDepth = (() => {
    if (!canUseNormalFoodActions || normalizedFood <= 0) return 0;

    const NEG_INF = Number.NEGATIVE_INFINITY;
    const dp = Array.from({ length: normalizedFood + 1 }, () => [
      NEG_INF,
      NEG_INF,
      NEG_INF,
    ]);
    dp[0][0] = 0;

    for (let cost = 0; cost <= normalizedFood; cost += 1) {
      for (const phase of [0, 1, 2] as StepUpPhaseIndex[]) {
        const current = dp[cost][phase];
        if (!Number.isFinite(current)) continue;

        if (cost + 150 <= normalizedFood) {
          dp[cost + 150][phase] = Math.max(dp[cost + 150][phase], current + 1);
        }
        if (cost + 1500 <= normalizedFood) {
          dp[cost + 1500][phase] = Math.max(
            dp[cost + 1500][phase],
            current + AUTO_COUNT_PER_TEN_ROLL,
          );
        }

        if (phase === 0 && cost + 300 <= normalizedFood) {
          dp[cost + 300][1] = Math.max(dp[cost + 300][1], current + 3);
        }
        if (phase === 1 && cost + 750 <= normalizedFood) {
          dp[cost + 750][2] = Math.max(dp[cost + 750][2], current + 5);
        }
        if (phase === 2 && cost + 1050 <= normalizedFood) {
          dp[cost + 1050][0] = Math.max(dp[cost + 1050][0], current + 7);
        }
      }
    }

    let best = 0;
    for (let cost = 0; cost <= normalizedFood; cost += 1) {
      for (let phase = 0; phase <= 2; phase += 1) {
        best = Math.max(best, dp[cost][phase] || 0);
      }
    }
    return best;
  })();

  const normalDepth = poolTypes.has("normal")
    ? clampNonNegativeInt(resources.tickets) +
      foodDepth
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
