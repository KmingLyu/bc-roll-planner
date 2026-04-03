import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GitBranch, Mail, PencilLine, Search } from "lucide-react";
import type { Event, TrackGraph } from "@/types/models";
import { ApiError, isAbortError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { EventsPicker, useEvents } from "@/features/events";
import { TargetCatsSelectionContent, useEventCats } from "@/features/cats";
import {
  buildGodfatCatHref,
  buildGodfatCatImageUrl,
} from "@/features/cats/presentation/godfat";
import { useTrackGraphs } from "@/features/track-graph";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DisclaimerNote } from "./components/Note";
import { ResourceForm } from "./components/ResourceForm";
import { RunBlockingOverlay } from "./components/RunBlockingOverlay";
import { RunBar } from "./components/RunBar";
import { SeedCountForm } from "./components/SeedCountForm";
import { ResultStatsSidebar } from "./components/ResultStats";
import { ResultTable, type ResultFilterMode } from "./components/Results";
import { usePlannerWorker } from "./hooks/usePlannerWorker";
import type { PlanResult } from "./logic/core";
import type {
  PlannerAppliedInputs,
  PlannerDraftInputs,
  PlannerResources,
  PlannerSessionState,
} from "./types";
import { parsePosId } from "@/utils/cursor";
import { BC_ENV } from "@/config/bcEnv";

type LoadState = "idle" | "loading" | "ok" | "error";

const MAX_SELECTED_EVENTS = 5;
const MAX_SELECTED_TARGET_CATS = 20;

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

type PlannerScreenContextValue = {
  draft: PlannerDraftInputs;
  session: PlannerSessionState;
  appliedSession: AppliedPlannerSession | null;
  planState: LoadState;
  planErr: string;
  countError: string;
  manualCount: number | null;
  autoCount: number;
  resolvedCount: number;
  resultsStale: boolean;
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

function safeErrText(error: unknown): string {
  if (error instanceof ApiError)
    return `${error.message} (HTTP ${error.status})`;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

function clampNonNegativeInt(value: number): number {
  return Math.max(0, Math.floor(value || 0));
}

function clampSelection<T>(values: T[], limit: number) {
  return [...new Set(values)].slice(0, limit);
}

function getStartPosOffset(startPosId: string): number {
  try {
    return Math.max(0, parsePosId((startPosId || "1A").trim() || "1A").pos - 1);
  } catch {
    return 0;
  }
}

function estimateAutoCount(params: {
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

  const normalDepth = poolTypes.has("normal")
    ? clampNonNegativeInt(resources.tickets) +
      Math.floor(clampNonNegativeInt(resources.food) / 150)
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

function parseManualCount(countInput: string): {
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

function buildDraftSignature(draft: PlannerDraftInputs) {
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
  const resultsStale = appliedSession
    ? draftSignature !== appliedSession.signature
    : false;

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
    resultsStale,
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

function usePlannerScreen() {
  const context = useContext(PlannerScreenContext);
  if (!context) {
    throw new Error("Planner screen context is missing.");
  }
  return context;
}

function PlannerHeader() {
  return (
    <header className="space-y-2 border-b border-border/45 pb-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          貓咪大戰爭抽卡規劃
        </h1>
      </div>
      <DisclaimerNote />
    </header>
  );
}

function PlannerFooter() {
  return (
    <footer className="mt-2 border-t border-border/45 pt-5 pb-2 sm:pt-6 sm:pb-3">
      <div className="flex justify-end">
        <div className="flex max-w-[760px] flex-wrap items-center justify-end gap-x-3 gap-y-2.5 text-[15px] text-muted-foreground/85">
          <span className="text-[14px] font-semibold text-muted-foreground/75">
            問題回報：
          </span>

          <span className="text-border/80">·</span>

          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <a
              href="mailto:keming0325@gmail.com"
              title="keming0325@gmail.com"
              aria-label="寄信到 keming0325@gmail.com"
              className="group inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Mail className="size-[18px] shrink-0" />
              <span className="font-medium">Email</span>
            </a>

            <span className="text-border/80">·</span>

            <a
              href="https://github.com/KmingLyu/bc-roll-planner"
              target="_blank"
              rel="noreferrer"
              title="github.com/KmingLyu/bc-roll-planner"
              aria-label="前往 GitHub 專案頁回報 issue"
              className="group inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <GitBranch className="size-[18px] shrink-0" />
              <span className="font-medium">GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SelectedCatSummaryItem({
  catId,
  name,
}: {
  catId: number;
  name: string;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-muted/28 px-2.5 py-1.5">
      <img
        src={buildGodfatCatImageUrl(catId, { lang: BC_ENV.lang })}
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0 rounded-md bg-background object-cover"
        loading="lazy"
      />
      <span className="min-w-0 break-keep text-sm font-medium leading-5 text-foreground">
        {name}
      </span>
    </div>
  );
}

function PlannerTargetPanel() {
  const {
    catsState,
    catsErr,
    tierGroups,
    catNameById,
    draft,
    setTargetCatIds,
    clearTargetCatIds,
  } = usePlannerScreen();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [catQuery, setCatQuery] = useState("");

  const selectedCats = useMemo(() => {
    const namesFromGroups = new Map<number, string>();
    for (const group of tierGroups) {
      for (const cat of group.cats) {
        namesFromGroups.set(cat.id, cat.name);
      }
    }

    return draft.targetCatIds.map((catId) => ({
      id: catId,
      name:
        namesFromGroups.get(catId) ??
        catNameById.get(catId) ??
        `貓咪 #${catId}`,
    }));
  }, [catNameById, draft.targetCatIds, tierGroups]);
  const visibleSelectedCats = selectedCats.slice(0, MAX_SELECTED_TARGET_CATS);
  const hiddenSelectedCatCount = Math.max(
    0,
    selectedCats.length - visibleSelectedCats.length,
  );
  const atSelectionLimit =
    draft.targetCatIds.length >= MAX_SELECTED_TARGET_CATS;
  const selectionSummary = atSelectionLimit
    ? `已達上限 ${MAX_SELECTED_TARGET_CATS} 隻，取消已選貓咪後才能更換。`
    : draft.targetCatIds.length === 0
      ? `最多可選 ${MAX_SELECTED_TARGET_CATS} 隻目標貓咪。`
      : `還可再選 ${MAX_SELECTED_TARGET_CATS - draft.targetCatIds.length} 隻目標貓咪。`;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-foreground">
            選擇目標貓咪
          </div>
          <Badge variant={atSelectionLimit ? "warning" : "muted"}>
            {draft.targetCatIds.length}/{MAX_SELECTED_TARGET_CATS}
          </Badge>
          {draft.targetCatIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-auto rounded-none border-l border-border/55 px-0 pl-3 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={clearTargetCatIds}
            >
              清空
            </Button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="group block w-full rounded-2xl border border-border/55 bg-background px-4 py-3 text-left transition-colors hover:border-border hover:bg-muted/[0.04] active:bg-muted/[0.08]"
      >
        {selectedCats.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {visibleSelectedCats.map((cat) => (
              <SelectedCatSummaryItem
                key={cat.id}
                catId={cat.id}
                name={cat.name}
              />
            ))}
            {hiddenSelectedCatCount > 0 ? (
              <div className="inline-flex items-center rounded-full bg-muted/24 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                +{hiddenSelectedCatCount} 隻已選貓咪
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-2 text-sm text-muted-foreground">
            點擊選擇目標貓咪
          </div>
        )}
      </button>
      <div
        className={cn(
          "px-1 text-xs",
          atSelectionLimit
            ? "font-medium text-warning"
            : "text-muted-foreground",
        )}
      >
        {selectionSummary}
      </div>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={(nextOpen) => {
          setSheetOpen(nextOpen);
          if (!nextOpen) setCatQuery("");
        }}
        title={`選擇目標貓咪 (${draft.targetCatIds.length}/${MAX_SELECTED_TARGET_CATS})`}
        toolbar={
          <div className="flex items-center gap-4">
            <div className="w-20 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearTargetCatIds}
                className={cn(
                  "h-auto w-full shrink-0 justify-end px-0 pr-2 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground",
                  draft.targetCatIds.length > 0 ? "visible" : "invisible",
                )}
                tabIndex={draft.targetCatIds.length > 0 ? 0 : -1}
                aria-hidden={draft.targetCatIds.length > 0 ? undefined : true}
              >
                清空
              </Button>
            </div>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="target-cat-search-header"
                autoComplete="off"
                autoFocus
                value={catQuery}
                onChange={(event) => setCatQuery(event.target.value)}
                placeholder="搜尋目標貓咪"
                className="workspace-search pl-11"
              />
            </div>
          </div>
        }
      >
        <TargetCatsSelectionContent
          loadState={catsState}
          error={catsErr}
          groups={tierGroups}
          selectedIds={draft.targetCatIds}
          maxSelection={MAX_SELECTED_TARGET_CATS}
          onChange={setTargetCatIds}
          onClear={clearTargetCatIds}
          query={catQuery}
          onQueryChange={setCatQuery}
          hideSearchInput
          getCatHref={(catId) =>
            buildGodfatCatHref(catId, {
              lang: BC_ENV.lang,
              ui: BC_ENV.ui,
            })
          }
          getCatImageUrl={(catId) =>
            buildGodfatCatImageUrl(catId, { lang: BC_ENV.lang })
          }
          dense
        />
      </BottomSheet>
    </section>
  );
}

function PlannerInputEditor({ layout }: { layout: "immersive" | "compact" }) {
  const {
    draft,
    session,
    countError,
    autoCount,
    manualCount,
    setSeed,
    setCountInput,
    setResources,
    setSelectedEventValues,
    toggleManualCount,
    eventsState,
    eventsErr,
    upcomingEvents,
    pastEvents,
    planState,
    planErr,
    resultsStale,
    runDisabled,
    runHint,
    appliedSession,
    runPlannerFlow,
  } = usePlannerScreen();

  const content = (
    <>
      <div className="space-y-5">
        <SeedCountForm
          seed={draft.seed}
          countInput={draft.countInput}
          countError={countError}
          autoCount={autoCount}
          manualCount={manualCount}
          manualCountExpanded={session.manualCountExpanded}
          onSeedChange={setSeed}
          onCountInputChange={setCountInput}
          onToggleManualCount={toggleManualCount}
        />

        <div className="workspace-divider pt-3.5">
          <ResourceForm value={draft.resources} onChange={setResources} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.35fr)]">
          <div className="border-t border-border pt-5">
            <EventsPicker
              loadState={eventsState}
              error={eventsErr}
              upcomingEvents={upcomingEvents}
              pastEvents={pastEvents}
              value={draft.selectedEventValues}
              maxSelection={MAX_SELECTED_EVENTS}
              onChange={setSelectedEventValues}
            />
          </div>

          <div className="border-t border-border pt-5">
            <PlannerTargetPanel />
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <div className="space-y-3">
            <RunBar
              state={planState}
              onRun={() => {
                void runPlannerFlow();
              }}
              disabled={runDisabled}
              hint={runHint}
              error={planErr}
              stale={resultsStale}
              hasResult={!!appliedSession}
            />
          </div>
        </div>
      </div>
    </>
  );

  if (layout === "compact") {
    return <div className="space-y-5">{content}</div>;
  }

  return (
    <Card className="workspace-pane border-border/55">
      <CardContent className="space-y-5 px-4 py-3.5 sm:px-4 sm:py-4">
        {content}
      </CardContent>
    </Card>
  );
}

function PlannerInputStage() {
  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PlannerInputEditor layout="immersive" />
    </div>
  );
}

function PlannerSidebarRail() {
  const { appliedSession, catNameById, goToInputStage } = usePlannerScreen();

  if (!appliedSession) return null;

  return (
    <Card className="workspace-pane sticky top-0 self-start border-border/55">
      <div className="workspace-toolbar">
        <div className="flex items-center gap-2.5">
          <div className="text-sm font-semibold text-foreground">結果摘要</div>
          <Badge
            variant={appliedSession.result.success ? "success" : "warning"}
            className={cn(
              "rounded-full px-2.5 py-1 text-[12px] font-semibold tracking-normal",
              appliedSession.result.success
                ? "bg-success/12 text-success"
                : "bg-warning/12 text-warning",
            )}
          >
            {appliedSession.result.success ? "已命中全部目標" : "尚未完全命中"}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={goToInputStage}>
          <PencilLine className="size-4" />
          重新輸入
        </Button>
      </div>
      <CardContent className="subtle-scrollbar max-h-[calc(100vh-3rem)] overflow-y-auto">
        <ResultStatsSidebar
          result={appliedSession.result}
          graphsByEvent={appliedSession.graphsByEvent}
          catNameById={catNameById}
        />
      </CardContent>
    </Card>
  );
}

function PlannerResultsView(props: {
  filterMode: ResultFilterMode;
  onFilterModeChange: (next: ResultFilterMode) => void;
}) {
  const { filterMode, onFilterModeChange } = props;
  const { appliedSession, catNameById } = usePlannerScreen();

  if (!appliedSession) return null;

  return (
    <div className="workspace-pane border-border/55">
      <ResultTable
        result={appliedSession.result}
        graphsByEvent={appliedSession.graphsByEvent}
        targetCatIds={appliedSession.inputs.targetCatIds}
        catNameById={catNameById}
        filterMode={filterMode}
        onFilterModeChange={onFilterModeChange}
      />
    </div>
  );
}

function PlannerResultsStage() {
  const { appliedSession, catNameById, goToInputStage } = usePlannerScreen();
  const [resultFilterMode, setResultFilterMode] =
    useState<ResultFilterMode>("all");

  if (!appliedSession) {
    return <PlannerInputStage />;
  }

  return (
    <div className="space-y-4">
      <div className="lg:hidden">
        <Card className="workspace-pane border-border/55">
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="text-sm font-semibold text-foreground">
                  結果摘要
                </div>
                <Badge
                  variant={
                    appliedSession.result.success ? "success" : "warning"
                  }
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[12px] font-semibold tracking-normal",
                    appliedSession.result.success
                      ? "bg-success/12 text-success"
                      : "bg-warning/12 text-warning",
                  )}
                >
                  {appliedSession.result.success
                    ? "已命中全部目標"
                    : "尚未完全命中"}
                </Badge>
              </div>
            </div>
            <ResultStatsSidebar
              result={appliedSession.result}
              graphsByEvent={appliedSession.graphsByEvent}
              catNameById={catNameById}
              compact
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={goToInputStage}>
                <PencilLine className="size-4" />
                重新輸入
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:grid lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[minmax(300px,320px)_minmax(0,1fr)]">
        <PlannerSidebarRail />
        <PlannerResultsView
          filterMode={resultFilterMode}
          onFilterModeChange={setResultFilterMode}
        />
      </div>

      <div className="lg:hidden">
        <PlannerResultsView
          filterMode={resultFilterMode}
          onFilterModeChange={setResultFilterMode}
        />
      </div>
    </div>
  );
}

function PlannerScreen() {
  const { session, appliedSession, runOverlayOpen, cancelPlannerFlow } =
    usePlannerScreen();
  const topRef = useRef<HTMLDivElement | null>(null);
  const isResultsStage = session.stage === "results" && !!appliedSession;
  const shouldRestoreInputView = session.stage === "input" && !!appliedSession;

  useEffect(() => {
    if (!isResultsStage) return;

    topRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [isResultsStage]);

  useEffect(() => {
    if (!shouldRestoreInputView) return;

    topRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [shouldRestoreInputView]);

  useEffect(() => {
    if (!runOverlayOpen) return;

    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = prevBodyOverflow;
      documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [runOverlayOpen]);

  return (
    <>
      <div
        className={cn(
          "mx-auto w-full space-y-4",
          isResultsStage ? "max-w-[1480px]" : "max-w-[1220px]",
        )}
      >
        <div ref={topRef} />
        <PlannerHeader />
        {isResultsStage ? <PlannerResultsStage /> : <PlannerInputStage />}
        <PlannerFooter />
      </div>
      <RunBlockingOverlay open={runOverlayOpen} onCancel={cancelPlannerFlow} />
    </>
  );
}

export function PlannerPageContainer() {
  return (
    <PlannerScreenProvider>
      <PlannerScreen />
    </PlannerScreenProvider>
  );
}
