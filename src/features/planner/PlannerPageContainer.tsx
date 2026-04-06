import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Event, TrackGraph } from "@/types/models";
import { isAbortError } from "@/lib/api-client";
import { safeErrText } from "@/lib/error";
import { clampSelection } from "@/lib/selection";
import { useEvents } from "@/features/events";
import { useEventCats } from "@/features/cats";
import { useTrackGraphs } from "@/features/track-graph";
import { BC_ENV } from "@/config/env";
import {
  MAX_SELECTED_EVENTS,
  MAX_SELECTED_TARGET_CATS,
  clampNonNegativeInt,
  estimateAutoCount,
  parseManualCount,
  buildDraftSignature,
} from "./logic/helpers";
import { usePlannerWorker } from "./usePlannerWorker";
import type { PlanResult } from "./logic/core";
import type {
  PlannerAppliedInputs,
  PlannerDraftInputs,
  PlannerResources,
  PlannerSessionState,
} from "./types";
import { Screen } from "./components/Screen";

import type { LoadState } from "@/lib/loadState";

type AppliedPlannerSession = {
  signature: string;
  inputs: PlannerAppliedInputs;
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
};

type ActivePlannerRun = {
  token: number;
  controller: AbortController;
};

export type PlannerScreenContextValue = {
  draft: PlannerDraftInputs;
  session: PlannerSessionState;
  appliedSession: AppliedPlannerSession | null;
  planState: LoadState;
  planErr: string;
  countError: string;
  manualCount: number | null;
  autoCount: number;
  resolvedCount: number;
  runDisabled: boolean;
  runHint: string;
  runOverlayOpen: boolean;
  eventsState: LoadState;
  eventsErr: string;
  upcomingEvents: Event[];
  pastEvents: Event[];
  catsState: LoadState;
  catsErr: string;
  tierGroups: ReturnType<typeof useEventCats>["tierGroups"];
  catNameById: Map<number, string>;
  setSeed: (value: string) => void;
  setCountInput: (value: string) => void;
  setResources: (next: PlannerResources) => void;
  setSelectedEventValues: (next: string[]) => void;
  setPrimaryEventValue: (value: string) => void;
  setTargetCatIds: (next: number[]) => void;
  clearTargetCatIds: () => void;
  toggleManualCount: () => void;
  goToInputStage: () => void;
  cancelPlannerFlow: () => void;
  runPlannerFlow: () => Promise<void>;
};

const PlannerScreenContext = createContext<PlannerScreenContextValue | null>(
  null,
);

export function usePlannerScreen() {
  const context = useContext(PlannerScreenContext);
  if (!context) {
    throw new Error("Planner screen context is missing.");
  }
  return context;
}

function PlannerScreenProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<PlannerDraftInputs>({
    seed: "",
    countInput: "",
    resources: {
      tickets: 0,
      platinum_tickets: 0,
      legend_tickets: 0,
      food: 0,
    },
    cfg: {
      start_pos_id: "1A",
      max_expansions: 200000,
    },
    selectedEventValues: [],
    primaryEventValue: "",
    targetCatIds: [],
  });

  const [session, setSession] = useState<PlannerSessionState>({
    stage: "input",
    manualCountExpanded: false,
  });
  const [appliedSession, setAppliedSession] =
    useState<AppliedPlannerSession | null>(null);
  const hasSyntheticResultsHistoryRef = useRef(false);

  const pendingRunRef = useRef<{
    token: number;
    signature: string;
    inputs: PlannerAppliedInputs;
    graphsByEvent: Record<string, TrackGraph>;
  } | null>(null);
  const activeRunRef = useRef<ActivePlannerRun | null>(null);
  const runTokenRef = useRef(0);

  const { manualCount, countError } = useMemo(
    () => parseManualCount(draft.countInput),
    [draft.countInput],
  );

  const { eventsState, eventsErr, events, upcomingEvents, pastEvents } =
    useEvents({
      pastLimit: BC_ENV.pastEventLimit,
      lang: BC_ENV.lang,
      ui: BC_ENV.ui,
    });

  const eventsByValue = useMemo(() => {
    const next = new Map<string, Event>();
    for (const event of events) next.set(event.value, event);
    return next;
  }, [events]);

  const resolvedPrimaryEventValue = useMemo(() => {
    if (!draft.selectedEventValues.length) return "";
    return draft.selectedEventValues.includes(draft.primaryEventValue)
      ? draft.primaryEventValue
      : draft.selectedEventValues[0];
  }, [draft.primaryEventValue, draft.selectedEventValues]);

  const autoCount = useMemo(
    () =>
      estimateAutoCount({
        selectedEventValues: draft.selectedEventValues,
        eventsByValue,
        resources: draft.resources,
        startPosId: draft.cfg.start_pos_id,
      }),
    [
      draft.cfg.start_pos_id,
      draft.resources,
      draft.selectedEventValues,
      eventsByValue,
    ],
  );

  const resolvedCount = manualCount ?? autoCount;

  const { catsState, catsErr, tierGroups, allowedCatIdSet, catNameById } =
    useEventCats({
      selectedEventValues: draft.selectedEventValues,
      eventsByValue,
      lang: BC_ENV.lang,
      ui: BC_ENV.ui,
    });

  const resolvedTargetCatIds = useMemo(() => {
    if (!allowedCatIdSet) return draft.targetCatIds;
    return draft.targetCatIds.filter((catId) => allowedCatIdSet.has(catId));
  }, [allowedCatIdSet, draft.targetCatIds]);

  const viewDraft = useMemo<PlannerDraftInputs>(
    () => ({
      ...draft,
      primaryEventValue: resolvedPrimaryEventValue,
      targetCatIds: resolvedTargetCatIds,
    }),
    [draft, resolvedPrimaryEventValue, resolvedTargetCatIds],
  );

  const { fetchGraphs } = useTrackGraphs({
    seed: viewDraft.seed.trim(),
    selectedEventValues: viewDraft.selectedEventValues,
    eventsByValue,
    lang: BC_ENV.lang,
    ui: BC_ENV.ui,
  });

  const {
    runPlanner,
    planErr,
    planResult,
    planState,
    setLoading,
    cancelPlanner,
  } = usePlannerWorker();

  const draftSignature = useMemo(
    () => buildDraftSignature(viewDraft),
    [viewDraft],
  );

  const hasSeed = viewDraft.seed.trim().length > 0;

  const runDisabled =
    planState === "loading" ||
    !viewDraft.selectedEventValues.length ||
    !hasSeed ||
    !!countError ||
    viewDraft.targetCatIds.length === 0 ||
    resolvedCount <= 0;

  const runHint = !viewDraft.selectedEventValues.length
    ? "請先選擇至少一個卡池。"
    : !hasSeed
      ? "請先輸入種子碼。"
      : countError
        ? "請修正 count。"
        : !viewDraft.targetCatIds.length
          ? "請先選擇至少一隻目標貓咪。"
          : resolvedCount <= 0
            ? "目前沒有可用資源可規劃。"
            : "";

  const runOverlayOpen = planState === "loading";

  function clearActiveRun(token?: number) {
    if (token != null && activeRunRef.current?.token !== token) return;
    activeRunRef.current = null;
  }

  function isCurrentRun(token: number) {
    return activeRunRef.current?.token === token;
  }

  function cancelPlannerFlow() {
    activeRunRef.current?.controller.abort();
    activeRunRef.current = null;
    pendingRunRef.current = null;
    cancelPlanner();
  }

  useEffect(() => {
    if (planState !== "ok" || !planResult || !pendingRunRef.current) return;

    const completedRun = pendingRunRef.current;
    pendingRunRef.current = null;
    clearActiveRun(completedRun.token);

    setAppliedSession({
      signature: completedRun.signature,
      inputs: completedRun.inputs,
      result: planResult,
      graphsByEvent: completedRun.graphsByEvent,
    });
    startTransition(() => {
      setSession((current) => ({
        ...current,
        stage: "results",
      }));
    });
  }, [planResult, planState]);

  useEffect(() => {
    if (planState !== "error") return;

    pendingRunRef.current = null;
    clearActiveRun();
  }, [planState]);

  useEffect(() => {
    if (session.stage !== "results" || hasSyntheticResultsHistoryRef.current)
      return;

    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        bcPlannerStage: "results",
      },
      "",
    );
    hasSyntheticResultsHistoryRef.current = true;
  }, [session.stage]);

  useEffect(() => {
    const onPopState = () => {
      setSession((current) => {
        if (current.stage !== "results") {
          return current;
        }

        hasSyntheticResultsHistoryRef.current = false;
        return {
          ...current,
          stage: "input",
        };
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    return () => {
      activeRunRef.current?.controller.abort();
      activeRunRef.current = null;
      pendingRunRef.current = null;
    };
  }, []);

  async function runPlannerFlow() {
    if (!viewDraft.selectedEventValues.length) {
      runPlanner({ kind: "errorOnly", error: "請先選擇至少一個卡池。" });
      return;
    }
    if (!hasSeed) {
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

    activeRunRef.current?.controller.abort();
    pendingRunRef.current = null;
    cancelPlanner();

    const token = ++runTokenRef.current;
    const controller = new AbortController();
    activeRunRef.current = {
      token,
      controller,
    };
    setLoading();

    let graphsByEvent: Record<string, TrackGraph>;
    try {
      graphsByEvent = await fetchGraphs(resolvedCount, {
        signal: controller.signal,
      });
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        !isCurrentRun(token)
      ) {
        return;
      }

      clearActiveRun(token);
      runPlanner({
        kind: "errorOnly",
        error: `取得 TrackGraph 失敗：${safeErrText(error)}`,
      });
      return;
    }

    if (controller.signal.aborted || !isCurrentRun(token)) {
      return;
    }

    const primary =
      viewDraft.primaryEventValue &&
      viewDraft.selectedEventValues.includes(viewDraft.primaryEventValue)
        ? viewDraft.primaryEventValue
        : viewDraft.selectedEventValues[0];

    const primaryGraph = primary ? graphsByEvent[primary] : undefined;
    if (!primaryGraph || !Object.keys(primaryGraph.nodes || {}).length) {
      clearActiveRun(token);
      runPlanner({
        kind: "errorOnly",
        error: "主要卡池的 TrackGraph 不存在或內容為空。",
      });
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
        events: viewDraft.selectedEventValues.map((eventValue) => ({
          event_value: eventValue,
        })),
        target_cats: viewDraft.targetCatIds,
        tickets: clampNonNegativeInt(viewDraft.resources.tickets),
        platinum_tickets: clampNonNegativeInt(
          viewDraft.resources.platinum_tickets,
        ),
        legend_tickets: clampNonNegativeInt(viewDraft.resources.legend_tickets),
        food: clampNonNegativeInt(viewDraft.resources.food),
        start_pos_id: (viewDraft.cfg.start_pos_id || "1A").trim(),
        cfg: {
          max_expansions: Math.max(
            1000,
            clampNonNegativeInt(viewDraft.cfg.max_expansions),
          ),
        },
      },
    });
  }

  const value: PlannerScreenContextValue = {
    draft: viewDraft,
    session,
    appliedSession,
    planState,
    planErr,
    countError,
    manualCount,
    autoCount,
    resolvedCount,
    runDisabled,
    runHint,
    runOverlayOpen,
    eventsState,
    eventsErr,
    upcomingEvents,
    pastEvents,
    catsState,
    catsErr,
    tierGroups,
    catNameById,
    setSeed: (value) => setDraft((current) => ({ ...current, seed: value })),
    setCountInput: (value) =>
      setDraft((current) => ({ ...current, countInput: value })),
    setResources: (next) =>
      setDraft((current) => ({ ...current, resources: next })),
    setSelectedEventValues: (next) =>
      setDraft((current) => ({
        ...current,
        selectedEventValues: clampSelection(next, MAX_SELECTED_EVENTS),
      })),
    setPrimaryEventValue: (value) =>
      setDraft((current) => ({ ...current, primaryEventValue: value })),
    setTargetCatIds: (next) =>
      setDraft((current) => ({
        ...current,
        targetCatIds: clampSelection(next, MAX_SELECTED_TARGET_CATS),
      })),
    clearTargetCatIds: () =>
      setDraft((current) => ({ ...current, targetCatIds: [] })),
    toggleManualCount: () =>
      startTransition(() =>
        setSession((current) => ({
          ...current,
          manualCountExpanded: !current.manualCountExpanded,
        })),
      ),
    goToInputStage: () => {
      if (hasSyntheticResultsHistoryRef.current) {
        window.history.back();
        return;
      }

      startTransition(() =>
        setSession((current) => ({
          ...current,
          stage: "input",
        })),
      );
    },
    cancelPlannerFlow,
    runPlannerFlow,
  };

  return (
    <PlannerScreenContext.Provider value={value}>
      {children}
    </PlannerScreenContext.Provider>
  );
}

export function PlannerPageContainer() {
  return (
    <PlannerScreenProvider>
      <Screen />
    </PlannerScreenProvider>
  );
}
