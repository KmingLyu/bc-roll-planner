import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Event } from "@/types/models";
import { clampSelection } from "@/lib/selection";
import { useEvents } from "@/features/events";
import { useEventCats } from "@/features/cats";
import { BC_ENV } from "@/config/env";
import {
  MAX_SELECTED_EVENTS,
  MAX_SELECTED_TARGET_CATS,
  estimateAutoCount,
  parseManualCount,
  buildDraftSignature,
} from "./logic/helpers";
import { usePlannerRun } from "./usePlannerRun";
import type {
  PlannerDraftInputs,
  PlannerSessionState,
} from "./types";
import { DraftContext, type DraftContextValue } from "./context/draftContext";
import { DataContext, type DataContextValue } from "./context/dataContext";
import {
  SessionContext,
  type SessionContextValue,
} from "./context/sessionContext";
import {
  DerivedContext,
  type DerivedContextValue,
} from "./context/derivedContext";
import { Screen } from "./components/Screen";

function PlannerProvider({ children }: { children: React.ReactNode }) {
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
  const hasSyntheticResultsHistoryRef = useRef(false);

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

  const draftSignature = useMemo(
    () => buildDraftSignature(viewDraft),
    [viewDraft],
  );

  const { appliedSession, planState, planErr, runPlannerFlow, cancelPlannerFlow } = usePlannerRun({
    draft,
    viewDraft,
    manualCount,
    resolvedCount,
    countError,
    draftSignature,
    eventsByValue,
    onComplete: () => startTransition(() => {
      setSession((current) => ({ ...current, stage: "results" }));
    }),
  });

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

  // ── Memoized context values ────────────────────────────────────────────

  const draftValue = useMemo<DraftContextValue>(
    () => ({
      draft: viewDraft,
      manualCountExpanded: session.manualCountExpanded,
      setSeed: (value) =>
        setDraft((current) => ({ ...current, seed: value })),
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
    }),
    [viewDraft, session.manualCountExpanded],
  );

  const dataValue = useMemo<DataContextValue>(
    () => ({
      eventsState,
      eventsErr,
      upcomingEvents,
      pastEvents,
      catsState,
      catsErr,
      tierGroups,
      catNameById,
    }),
    [
      eventsState,
      eventsErr,
      upcomingEvents,
      pastEvents,
      catsState,
      catsErr,
      tierGroups,
      catNameById,
    ],
  );

  function goToInputStage() {
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
  }

  const sessionValue: SessionContextValue = {
    stage: session.stage,
    appliedSession,
    planState,
    planErr,
    runOverlayOpen,
    goToInputStage,
    cancelPlannerFlow,
    runPlannerFlow,
  };

  const derivedValue = useMemo<DerivedContextValue>(
    () => ({
      countError,
      manualCount,
      autoCount,
      resolvedCount,
      runDisabled,
      runHint,
    }),
    [countError, manualCount, autoCount, resolvedCount, runDisabled, runHint],
  );

  return (
    <DataContext.Provider value={dataValue}>
      <DraftContext.Provider value={draftValue}>
        <DerivedContext.Provider value={derivedValue}>
          <SessionContext.Provider value={sessionValue}>
            {children}
          </SessionContext.Provider>
        </DerivedContext.Provider>
      </DraftContext.Provider>
    </DataContext.Provider>
  );
}

export function PlannerPageContainer() {
  return (
    <PlannerProvider>
      <Screen />
    </PlannerProvider>
  );
}
