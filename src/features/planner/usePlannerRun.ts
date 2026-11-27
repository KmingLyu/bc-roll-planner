import { useEffect, useRef, useState } from "react";
import type { Event, TrackGraph } from "@/types/models";
import { isAbortError } from "@/lib/api-client";
import { safeErrText } from "@/lib/error";
import { BC_ENV } from "@/config/env";
import { fetchTrackGraphs } from "@/features/track-graph";
import { clampNonNegativeInt } from "./logic/helpers";
import { usePlannerWorker } from "./usePlannerWorker";
import type { AppliedPlannerSession, PlannerDraftInputs, PlannerAppliedInputs } from "./types";

type PendingRun = {
  token: number;
  signature: string;
  inputs: PlannerAppliedInputs;
  graphsByEvent: Record<string, TrackGraph>;
};

export function usePlannerRun(params: {
  draft: PlannerDraftInputs;
  viewDraft: PlannerDraftInputs;
  manualCount: number | null;
  resolvedCount: number;
  countError: string;
  draftSignature: string;
  eventsByValue: Map<string, Event>;
  onComplete: () => void;
}) {
  const { draft, viewDraft, manualCount, resolvedCount, countError, draftSignature, eventsByValue, onComplete } = params;
  const [appliedSession, setAppliedSession] = useState<AppliedPlannerSession | null>(null);
  const pendingRunRef = useRef<PendingRun | null>(null);
  const activeRunRef = useRef<{ token: number; controller: AbortController } | null>(null);
  const runTokenRef = useRef(0);
  const { runPlanner, planErr, planResult, planState, setLoading, cancelPlanner } = usePlannerWorker();

  useEffect(() => {
    if (planState !== "ok" || !planResult || !pendingRunRef.current) return;
    const completedRun = pendingRunRef.current;
    pendingRunRef.current = null;
    if (activeRunRef.current?.token === completedRun.token) activeRunRef.current = null;
    setAppliedSession({
      signature: completedRun.signature,
      inputs: completedRun.inputs,
      result: planResult,
      graphsByEvent: completedRun.graphsByEvent,
    });
    onComplete();
  }, [planResult, planState, onComplete]);

  useEffect(() => {
    if (planState !== "error") return;
    pendingRunRef.current = null;
    activeRunRef.current = null;
  }, [planState]);

  useEffect(() => () => {
    activeRunRef.current?.controller.abort();
    activeRunRef.current = null;
    pendingRunRef.current = null;
  }, []);

  function cancelPlannerFlow() {
    activeRunRef.current?.controller.abort();
    activeRunRef.current = null;
    pendingRunRef.current = null;
    cancelPlanner();
  }

  async function runPlannerFlow() {
    if (!viewDraft.selectedEventValues.length) {
      runPlanner({ kind: "errorOnly", error: "請先選擇至少一個卡池。" });
      return;
    }
    if (!viewDraft.seed.trim()) {
      runPlanner({ kind: "errorOnly", error: "請先輸入種子碼。" });
      return;
    }
    if (countError) {
      runPlanner({ kind: "errorOnly", error: countError });
      return;
    }
    if (!viewDraft.targetCatIds.length) {
      runPlanner({ kind: "errorOnly", error: "請先選擇至少一隻目標貓咪。" });
      return;
    }
    if (!Number.isFinite(resolvedCount) || resolvedCount <= 0) {
      runPlanner({ kind: "errorOnly", error: "目前沒有可用資源可規劃。" });
      return;
    }

    cancelPlannerFlow();
    const token = ++runTokenRef.current;
    const controller = new AbortController();
    activeRunRef.current = { token, controller };
    setLoading();

    let graphsByEvent: Record<string, TrackGraph>;
    try {
      graphsByEvent = await fetchTrackGraphs({
        seed: viewDraft.seed,
        count: resolvedCount,
        selectedEventValues: viewDraft.selectedEventValues,
        eventsByValue,
        lang: BC_ENV.lang,
        ui: BC_ENV.ui,
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted || activeRunRef.current?.token !== token) return;
      activeRunRef.current = null;
      runPlanner({ kind: "errorOnly", error: `取得 TrackGraph 失敗：${safeErrText(error)}` });
      return;
    }
    if (controller.signal.aborted || activeRunRef.current?.token !== token) return;

    const primary = viewDraft.primaryEventValue && viewDraft.selectedEventValues.includes(viewDraft.primaryEventValue)
      ? viewDraft.primaryEventValue
      : viewDraft.selectedEventValues[0];
    const primaryGraph = primary ? graphsByEvent[primary] : undefined;
    if (!primaryGraph || !Object.keys(primaryGraph.nodes || {}).length) {
      activeRunRef.current = null;
      runPlanner({ kind: "errorOnly", error: "主要卡池的 TrackGraph 不存在或內容為空。" });
      return;
    }

    pendingRunRef.current = {
      token,
      signature: draftSignature,
      inputs: {
        ...draft,
        primaryEventValue: viewDraft.primaryEventValue,
        targetCatIds: viewDraft.targetCatIds,
        manualCount,
        resolvedCount,
      },
      graphsByEvent,
    };
    runPlanner({
      kind: "run",
      req: {
        graphs_by_event: graphsByEvent,
        events: viewDraft.selectedEventValues.map((eventValue) => ({ event_value: eventValue })),
        target_cats: viewDraft.targetCatIds,
        tickets: clampNonNegativeInt(viewDraft.resources.tickets),
        platinum_tickets: clampNonNegativeInt(viewDraft.resources.platinum_tickets),
        legend_tickets: clampNonNegativeInt(viewDraft.resources.legend_tickets),
        food: clampNonNegativeInt(viewDraft.resources.food),
        start_pos_id: (viewDraft.cfg.start_pos_id || "1A").trim(),
        cfg: { max_expansions: Math.max(1000, clampNonNegativeInt(viewDraft.cfg.max_expansions)) },
      },
    });
  }

  return { appliedSession, planState, planErr, runPlannerFlow, cancelPlannerFlow };
}
