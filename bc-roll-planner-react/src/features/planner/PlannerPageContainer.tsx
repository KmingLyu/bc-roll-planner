import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  Sparkles,
  Target,
} from "lucide-react";
import type { Event, TrackGraph } from "@/types/models";
import { ApiError } from "@/lib/api-client";
import { EventsPicker, useEvents } from "@/features/events";
import { TargetCatsSelectionContent, useEventCats } from "@/features/cats";
import { useTrackGraphs } from "@/features/track-graph";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DisclaimerNote } from "./components/Note";
import { ResourceForm } from "./components/ResourceForm";
import { RunBar } from "./components/RunBar";
import { SeedCountForm } from "./components/SeedCountForm";
import { ResultStatsCard } from "./components/ResultStats";
import { ResultTable } from "./components/Results";
import { usePlannerWorker } from "./hooks/usePlannerWorker";
import type { PlanResult } from "./logic/core";
import type {
  PlannerAppliedInputs,
  PlannerDraftInputs,
  PlannerResources,
  PlannerSessionState,
  PlannerUiConfig,
} from "./types";
import { parsePosId } from "@/utils/cursor";
import { BC_ENV } from "@/config/bcEnv";

type LoadState = "idle" | "loading" | "ok" | "error";

type AppliedPlannerSession = {
  signature: string;
  inputs: PlannerAppliedInputs;
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
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
  setCfg: (next: PlannerUiConfig) => void;
  setSelectedEventValues: (next: string[]) => void;
  setPrimaryEventValue: (value: string) => void;
  setTargetCatIds: (next: number[]) => void;
  clearTargetCatIds: () => void;
  toggleManualCount: () => void;
  toggleAdvancedSettings: () => void;
  toggleInputRail: () => void;
  openMobileEditor: () => void;
  closeMobileEditor: () => void;
  goToInputStage: () => void;
  runPlannerFlow: () => Promise<void>;
};

const PlannerScreenContext = createContext<PlannerScreenContextValue | null>(null);

function safeErrText(error: unknown): string {
  if (error instanceof ApiError) return `${error.message} (HTTP ${error.status})`;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

function clampNonNegativeInt(value: number): number {
  return Math.max(0, Math.floor(value || 0));
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
    inputRailOpen: false,
    mobileEditorOpen: false,
    manualCountExpanded: false,
    advancedSettingsOpen: false,
  });
  const [appliedSession, setAppliedSession] =
    useState<AppliedPlannerSession | null>(null);

  const pendingRunRef = useRef<{
    signature: string;
    inputs: PlannerAppliedInputs;
    graphsByEvent: Record<string, TrackGraph>;
  } | null>(null);

  const { manualCount, countError } = useMemo(
    () => parseManualCount(draft.countInput),
    [draft.countInput],
  );

  const {
    eventsState,
    eventsErr,
    events,
    upcomingEvents,
    pastEvents,
  } = useEvents({
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
    [draft.cfg.start_pos_id, draft.resources, draft.selectedEventValues, eventsByValue],
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

  const { runPlanner, planErr, planResult, planState } = usePlannerWorker();

  const draftSignature = useMemo(() => buildDraftSignature(viewDraft), [viewDraft]);
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
    ? "請先選擇至少一個 event。"
    : !hasSeed
      ? "請先輸入 seed。"
      : countError
        ? "請修正 count。"
        : !viewDraft.targetCatIds.length
          ? "請先選擇至少一隻目標貓。"
          : resolvedCount <= 0
            ? "目前沒有可用資源可規劃。"
            : "";

  useEffect(() => {
    if (planState !== "ok" || !planResult || !pendingRunRef.current) return;

    const completedRun = pendingRunRef.current;
    pendingRunRef.current = null;

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
        inputRailOpen: false,
        mobileEditorOpen: false,
      }));
    });
  }, [planResult, planState]);

  async function runPlannerFlow() {
    if (!viewDraft.selectedEventValues.length) {
      runPlanner({ kind: "errorOnly", error: "請先選擇至少一個 event。" });
      return;
    }
    if (!hasSeed) {
      runPlanner({ kind: "errorOnly", error: "請先輸入 seed。" });
      return;
    }
    if (countError) {
      runPlanner({ kind: "errorOnly", error: countError });
      return;
    }
    if (!viewDraft.targetCatIds.length) {
      runPlanner({ kind: "errorOnly", error: "請先選擇至少一隻目標貓。" });
      return;
    }
    if (!Number.isFinite(resolvedCount) || resolvedCount <= 0) {
      runPlanner({ kind: "errorOnly", error: "目前沒有可用資源可規劃。" });
      return;
    }

    let graphsByEvent: Record<string, TrackGraph>;
    try {
      graphsByEvent = await fetchGraphs(resolvedCount);
    } catch (error) {
      runPlanner({
        kind: "errorOnly",
        error: `取得 TrackGraph 失敗：${safeErrText(error)}`,
      });
      return;
    }

    const primary =
      viewDraft.primaryEventValue &&
      viewDraft.selectedEventValues.includes(viewDraft.primaryEventValue)
        ? viewDraft.primaryEventValue
        : viewDraft.selectedEventValues[0];

    const primaryGraph = primary ? graphsByEvent[primary] : undefined;
    if (!primaryGraph || !Object.keys(primaryGraph.nodes || {}).length) {
      runPlanner({
        kind: "errorOnly",
        error: "主要 event 的 TrackGraph 不存在或內容為空。",
      });
      return;
    }

    pendingRunRef.current = {
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
      eventsState,
      eventsErr,
      upcomingEvents,
      pastEvents,
      catsState,
      catsErr,
      tierGroups,
      catNameById,
      setSeed: (value) =>
        setDraft((current) => ({ ...current, seed: value })),
      setCountInput: (value) =>
        setDraft((current) => ({ ...current, countInput: value })),
      setResources: (next) =>
        setDraft((current) => ({ ...current, resources: next })),
      setCfg: (next) => setDraft((current) => ({ ...current, cfg: next })),
      setSelectedEventValues: (next) =>
        setDraft((current) => ({ ...current, selectedEventValues: next })),
      setPrimaryEventValue: (value) =>
        setDraft((current) => ({ ...current, primaryEventValue: value })),
      setTargetCatIds: (next) =>
        setDraft((current) => ({ ...current, targetCatIds: next })),
      clearTargetCatIds: () =>
        setDraft((current) => ({ ...current, targetCatIds: [] })),
      toggleManualCount: () =>
        startTransition(() =>
          setSession((current) => ({
            ...current,
            manualCountExpanded: !current.manualCountExpanded,
          })),
        ),
      toggleAdvancedSettings: () =>
        startTransition(() =>
          setSession((current) => ({
            ...current,
            advancedSettingsOpen: !current.advancedSettingsOpen,
          })),
        ),
      toggleInputRail: () =>
        startTransition(() =>
          setSession((current) => ({
            ...current,
            inputRailOpen: !current.inputRailOpen,
          })),
        ),
      openMobileEditor: () =>
        startTransition(() =>
          setSession((current) => ({ ...current, mobileEditorOpen: true })),
        ),
      closeMobileEditor: () =>
        startTransition(() =>
          setSession((current) => ({ ...current, mobileEditorOpen: false })),
        ),
      goToInputStage: () =>
        startTransition(() =>
          setSession((current) => ({
            ...current,
            stage: "input",
            mobileEditorOpen: false,
            inputRailOpen: false,
          })),
        ),
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
    <Card className="overflow-hidden rounded-[36px] border-border/80 bg-card/95 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.42)]">
      <CardHeader className="gap-4 bg-[linear-gradient(135deg,rgba(241,245,249,0.98),rgba(255,255,255,0.94))]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="size-3.5" />
              UI Redesign
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl sm:text-4xl">
                貓咪大戰爭抽卡規劃
              </CardTitle>
              <CardDescription className="max-w-2xl text-base">
                先整理你的 seed、資源與目標貓，再按一次執行。結果會用桌機與手機都好讀的方式呈現。
              </CardDescription>
            </div>
          </div>
          <div className="rounded-[28px] border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
            保留原本演算法與資料來源，只重構整體 UI 與互動流程。
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DisclaimerNote />
      </CardContent>
    </Card>
  );
}

function PlannerInputSummary({ compact = false }: { compact?: boolean }) {
  const { draft, resolvedCount, manualCount } = usePlannerScreen();

  const resourceSummary = [
    ["金券", draft.resources.tickets],
    ["白金券", draft.resources.platinum_tickets],
    ["傳說券", draft.resources.legend_tickets],
    ["罐頭", draft.resources.food],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Seed {draft.seed.trim() || "-"}</Badge>
        <Badge variant={manualCount != null ? "default" : "muted"}>
          {manualCount != null ? "手動 count" : "自動 count"} {resolvedCount}
        </Badge>
        <Badge variant="muted">events {draft.selectedEventValues.length}</Badge>
        <Badge variant="muted">目標 {draft.targetCatIds.length}</Badge>
      </div>

      <div
        className={
          compact
            ? "grid gap-3 text-sm text-muted-foreground"
            : "grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground"
        }
      >
        <div className="rounded-3xl border border-border/70 bg-muted/30 px-4 py-3">
          起始位置：<span className="font-medium text-foreground">{draft.cfg.start_pos_id}</span>
        </div>
        <div className="rounded-3xl border border-border/70 bg-muted/30 px-4 py-3">
          搜尋上限：<span className="font-medium text-foreground">{draft.cfg.max_expansions}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {resourceSummary.map(([label, value]) => (
          <Badge key={label} variant="outline">
            {label} {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function PlannerTargetPanel() {
  const {
    catsState,
    catsErr,
    tierGroups,
    draft,
    setTargetCatIds,
    clearTargetCatIds,
  } = usePlannerScreen();

  return (
    <Card className="rounded-[32px] border-border/80 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="size-4" />
          目標貓咪
        </CardTitle>
        <CardDescription>
          這裡會自動顯示目前已選 event 的可用貓咪聯集。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TargetCatsSelectionContent
          loadState={catsState}
          error={catsErr}
          groups={tierGroups}
          selectedIds={draft.targetCatIds}
          onChange={setTargetCatIds}
          onClear={clearTargetCatIds}
          minColWidth={190}
          dense
        />
      </CardContent>
    </Card>
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
    setCfg,
    setSelectedEventValues,
    setPrimaryEventValue,
    toggleManualCount,
    toggleAdvancedSettings,
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

  return (
    <div className="space-y-6">
      <div
        className={
          layout === "immersive"
            ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]"
            : "space-y-6"
        }
      >
        <div className="space-y-6">
          <Card className="rounded-[32px] border-border/80 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">輸入條件</CardTitle>
              <CardDescription>
                先確認 seed、count 與可用資源，再挑選這次要一起規劃的卡池。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              <ResourceForm
                value={draft.resources}
                cfg={draft.cfg}
                advancedOpen={session.advancedSettingsOpen}
                onChange={setResources}
                onCfgChange={setCfg}
                onToggleAdvanced={toggleAdvancedSettings}
              />

              <EventsPicker
                loadState={eventsState}
                error={eventsErr}
                upcomingEvents={upcomingEvents}
                pastEvents={pastEvents}
                value={draft.selectedEventValues}
                onChange={setSelectedEventValues}
                primaryValue={draft.primaryEventValue}
                onPrimaryChange={setPrimaryEventValue}
              />
            </CardContent>
          </Card>
        </div>

        <PlannerTargetPanel />
      </div>

      {appliedSession && resultsStale ? (
        <Alert variant="warning" title="條件已變更">
          目前畫面上的結果仍然保留，但你需要重新執行才能套用最新條件。
        </Alert>
      ) : null}

      <Card className="rounded-[32px] border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">
            {appliedSession ? "重新計算" : "開始執行"}
          </CardTitle>
          <CardDescription>
            只有按下執行後才會抓取 TrackGraph 並開始計算。
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}

function PlannerInputStage() {
  const { appliedSession } = usePlannerScreen();

  return (
    <div className="space-y-6">
      {appliedSession ? (
        <Alert variant="info" title="你正在重新調整條件">
          需要時可以回到上次計算結果，或直接用目前的新條件重新執行。
        </Alert>
      ) : null}
      <PlannerInputEditor layout="immersive" />
    </div>
  );
}

function PlannerInputRail() {
  const { session, resultsStale, toggleInputRail, goToInputStage } =
    usePlannerScreen();

  return (
    <Card className="rounded-[32px] border-border/80 shadow-none">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg">目前條件</CardTitle>
            <CardDescription>
              左側會保留條件摘要，必要時再展開重新輸入。
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={toggleInputRail}
            aria-label={session.inputRailOpen ? "收合條件編輯器" : "展開條件編輯器"}
          >
            {session.inputRailOpen ? (
              <ChevronLeft className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <PlannerInputSummary compact />

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={toggleInputRail}>
            <PencilLine className="size-4" />
            {session.inputRailOpen ? "收合編輯器" : "展開重新編輯"}
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={goToInputStage}>
            <ArrowLeft className="size-4" />
            回到輸入模式
          </Button>
        </div>

        {resultsStale ? (
          <Alert variant="warning">條件已變更，記得重新執行。</Alert>
        ) : null}

        {session.inputRailOpen ? <PlannerInputEditor layout="compact" /> : null}
      </CardContent>
    </Card>
  );
}

function PlannerResultsView() {
  const { appliedSession, catNameById, resultsStale } = usePlannerScreen();

  if (!appliedSession) return null;

  return (
    <div className="space-y-6">
      {resultsStale ? (
        <Alert variant="warning" title="結果尚未同步">
          你已經改過條件了，目前顯示的是上一次成功執行的結果。
        </Alert>
      ) : null}
      <ResultStatsCard
        result={appliedSession.result}
        graphsByEvent={appliedSession.graphsByEvent}
        catNameById={catNameById}
      />
      <ResultTable
        result={appliedSession.result}
        graphsByEvent={appliedSession.graphsByEvent}
        targetCatIds={appliedSession.inputs.targetCatIds}
        catNameById={catNameById}
      />
    </div>
  );
}

function PlannerResultsStage() {
  const {
    session,
    appliedSession,
    resultsStale,
    openMobileEditor,
    closeMobileEditor,
    goToInputStage,
  } = usePlannerScreen();

  if (!appliedSession) {
    return <PlannerInputStage />;
  }

  return (
    <div className="space-y-6">
      <div className="lg:hidden">
        <Card className="rounded-[32px] border-border/80 shadow-none">
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">已套用條件</div>
                <div className="text-sm text-muted-foreground">
                  先看結果，需要時再打開條件編輯器。
                </div>
              </div>
              {resultsStale ? <Badge variant="warning">條件已變更</Badge> : null}
            </div>
            <PlannerInputSummary compact />
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={openMobileEditor}>
                <PencilLine className="size-4" />
                編輯條件
              </Button>
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={goToInputStage}
              >
                <ArrowLeft className="size-4" />
                回到輸入模式
              </Button>
            </div>
          </CardContent>
        </Card>

        <Sheet
          open={session.mobileEditorOpen}
          onOpenChange={(open) => {
            if (open) {
              openMobileEditor();
            } else {
              closeMobileEditor();
            }
          }}
        >
          <SheetContent
            side="bottom"
            title="重新編輯條件"
            description="這裡的修改不會自動重算，仍然要按下重新執行。"
          >
            <PlannerInputEditor layout="compact" />
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
        <PlannerInputRail />
        <PlannerResultsView />
      </div>

      <div className="lg:hidden">
        <PlannerResultsView />
      </div>
    </div>
  );
}

function PlannerScreen() {
  const { session, appliedSession } = usePlannerScreen();

  return (
    <div className="space-y-6">
      <PlannerHeader />
      {session.stage === "results" && appliedSession ? (
        <PlannerResultsStage />
      ) : (
        <PlannerInputStage />
      )}
    </div>
  );
}

export function PlannerPageContainer() {
  return (
    <PlannerScreenProvider>
      <PlannerScreen />
    </PlannerScreenProvider>
  );
}
