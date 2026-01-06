// src/pages/PlannerPage.tsx
import { useEffect, useMemo, useState } from "react";

// MUI
import { Box, Container, Stack, Typography } from "@mui/material";

// Models
import type { Event, TrackGraph } from "../../shared/models";

// APIs
import { ApiError } from "../api/netlifyClient";

// Hooks
import { useEvents } from "../hooks/useEvents";
import {
  useEventCats,
  type TierGroup,
  type CatTier,
} from "../hooks/useEventCats";
import { useTrackGraphs } from "../hooks/useTrackGraphs";
import { usePlannerWorker } from "../hooks/usePlannerWorker";

// Components
import { Section } from "../components/layout/Section";
import { ControlPanel, type UiFlags } from "../components/layout/ControlPanel";
import { SeedCountForm } from "../components/inputs/SeedCountForm";
import { EventsPicker } from "../components/events/EventsPicker";
import { TargetCatsPicker } from "../components/cats/TargetCatsPicker";
import { GraphSummaryCard } from "../components/graph/GraphSummaryCard";
import {
  ResourceForm,
  type PlannerResources,
  type PlannerConfig,
} from "../components/planner/ResourceForm";
import { PlannerRunBar } from "../components/planner/PlannerRunBar";
import { PlanResultSummary } from "../components/planner/PlanResultSummary";
import { PlanStepsTable } from "../components/planner/PlanStepsTable";
import { PlanResultInspector } from "../components/planner/PlanResultInspector";
import { SimulatorPanel } from "../components/simulator/SimulatorPanel";

// Planner types
import type { PlanResult } from "../core/planner";

// env
import { BC_ENV } from "../config/bcEnv";

type LoadState = "idle" | "loading" | "ok" | "error";

function tierOrder(t: CatTier): number {
  if (t === "legendary") return 0;
  if (t === "uber") return 1;
  if (t === "super") return 2;
  return 3;
}

function safeErrText(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (HTTP ${e.status})`;
  if (e && typeof e === "object" && "message" in e)
    return String((e as any).message);
  return String(e);
}

export default function PlannerPage() {
  // -------------------------
  // UI flags
  // -------------------------
  const [ui, setUi] = useState<UiFlags>({
    showControlPanel: false,

    showSeedCount: true,
    seedCountCollapsed: false,

    showEvents: true,
    eventsCollapsed: false,

    showTargetCats: true,
    targetCatsCollapsed: false,

    showPlanner: true,
    plannerCollapsed: false,

    showGraphDebug: false,
    graphDebugCollapsed: true,

    showSimulator: false,
    simulatorCollapsed: true,
  });

  // -------------------------
  // Seed/Count
  // -------------------------
  const [seedApplied, setSeedApplied] = useState<string>("");
  const [countApplied, setCountApplied] = useState<number | null>(null);

  // -------------------------
  // Events（一次載入 upcoming + past）
  // -------------------------
  const {
    eventsState,
    eventsErr,
    events,
    upcomingEvents,
    pastEvents,
    reloadEvents,
  } = useEvents({
    pastLimit: BC_ENV.pastEventLimit,
    lang: BC_ENV.lang,
    ui: BC_ENV.ui,
  });

  // 多選 values
  const [selectedEventValues, setSelectedEventValues] = useState<string[]>([]);

  // primary event：Graph Debug / Simulator 用
  const [primaryEventValue, setPrimaryEventValue] = useState<string>("");

  // 任何時候 selectedEventValues 改變：確保 primary 仍有效
  useEffect(() => {
    if (!selectedEventValues.length) {
      setPrimaryEventValue("");
      return;
    }
    if (
      !primaryEventValue ||
      !selectedEventValues.includes(primaryEventValue)
    ) {
      setPrimaryEventValue(selectedEventValues[0]);
    }
  }, [selectedEventValues, primaryEventValue]);

  // Map for easy lookup
  const eventsByValue = useMemo(() => {
    const m = new Map<string, Event>();
    for (const e of events) m.set(e.value, e);
    return m;
  }, [events]);

  // 是否設定了 seed/count
  const hasSeedCount = useMemo(() => {
    const okSeed = !!seedApplied.trim();
    const okCount =
      typeof countApplied === "number" &&
      Number.isFinite(countApplied) &&
      countApplied > 0;
    return okSeed && okCount;
  }, [seedApplied, countApplied]);

  // -------------------------
  // Target Cats：依 selectedEventValues 自動載入（多事件 union）
  // -------------------------
  const { catsState, catsErr, tierGroups, allowedCatIdSet, catNameById } =
    useEventCats({
      selectedEventValues,
      eventsByValue,
      lang: BC_ENV.lang,
      ui: BC_ENV.ui,
      // base_url: BC_ENV.baseUrl,
    });

  const [targetCatIds, setTargetCatIds] = useState<number[]>([]);

  // 修剪：把已選但不在聯集中允許的 id 移除
  useEffect(() => {
    if (!allowedCatIdSet) return;
    setTargetCatIds((prev) => prev.filter((id) => allowedCatIdSet.has(id)));
  }, [allowedCatIdSet]);

  // -------------------------
  // Graph：按 Planner 前先 ensure 最新（多 events）
  // -------------------------
  const { graphState, graphErr, graphByEvent, fetchGraphs, clearGraphs } =
    useTrackGraphs({
      seed: seedApplied,
      count: countApplied, // number | null
      selectedEventValues,
      eventsByValue,
      lang: BC_ENV.lang,
      ui: BC_ENV.ui,
      // base_url: BC_ENV.baseUrl,
    });

  // 參數變動時清掉 graphs（避免舊 graph 造成誤解）
  useEffect(() => {
    clearGraphs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedApplied, countApplied, selectedEventValues.join("|")]);

  // Graph Debug / Simulator 用 primaryEventValue
  const activeGraph: TrackGraph | null = useMemo(() => {
    if (!primaryEventValue) return null;
    return graphByEvent[primaryEventValue] ?? null;
  }, [graphByEvent, primaryEventValue]);

  // -------------------------
  // Planner resources + cfg
  // -------------------------
  const [resources, setResources] = useState<PlannerResources>({
    tickets: 10,
    platinum_tickets: 0,
    legend_tickets: 0,
    food: 3000,
  });

  const [plannerCfg, setPlannerCfg] = useState<PlannerConfig>({
    start_pos_id: "1A",
    max_expansions: 200000,
  });

  // -------------------------
  // Planner worker
  // -------------------------
  const { runPlanner, planState, planErr, planResult, resetPlan } =
    usePlannerWorker();

  useEffect(() => {
    resetPlan();
  }, [resources, plannerCfg.start_pos_id, plannerCfg.max_expansions]);

  async function onClickPlanner() {
    if (!selectedEventValues.length) {
      resetPlan();
      return runPlanner({ kind: "errorOnly", error: "請先選擇至少一個 event" });
    }
    if (!hasSeedCount) {
      resetPlan();
      return runPlanner({
        kind: "errorOnly",
        error: "請先在最上方套用 seed / count（count 必須為正整數）",
      });
    }
    if (!targetCatIds.length) {
      resetPlan();
      return runPlanner({ kind: "errorOnly", error: "請先選至少一隻目標貓" });
    }

    let graphsByEvent: Record<string, TrackGraph>;
    try {
      graphsByEvent = await fetchGraphs();
    } catch (e) {
      resetPlan();
      return runPlanner({
        kind: "errorOnly",
        error: `取得 TrackGraph 失敗：${safeErrText(e)}`,
      });
    }

    // primary 的選法要保證在 selected 裡
    const primary =
      primaryEventValue && selectedEventValues.includes(primaryEventValue)
        ? primaryEventValue
        : selectedEventValues[0];

    const g = primary ? graphsByEvent[primary] : undefined;

    // 判斷 graph 有效性
    const ok = !!g && Object.keys(g.nodes ?? {}).length > 0;

    if (!ok) {
      resetPlan();
      return runPlanner({
        kind: "errorOnly",
        error: "主要 event 的 TrackGraph 不存在（可能抓取失敗或回傳為空）",
      });
    }

    runPlanner({
      kind: "run",
      req: {
        graphs_by_event: graphsByEvent,

        // 不再塞 pool_type，planner 會從 graphs_by_event[ev].event.pool_type 讀
        events: selectedEventValues.map((ev) => ({ event_value: ev })),

        target_cats: targetCatIds,

        tickets: Math.max(0, Math.floor(resources.tickets)),
        platinum_tickets: Math.max(0, Math.floor(resources.platinum_tickets)),
        legend_tickets: Math.max(0, Math.floor(resources.legend_tickets)),
        food: Math.max(0, Math.floor(resources.food)),

        start_pos_id: (plannerCfg.start_pos_id || "1A").trim(),
        cfg: {
          max_expansions: Math.max(1000, Math.floor(plannerCfg.max_expansions)),
        },
      },
    });
  }

  const missingText = useMemo(() => {
    if (!planResult?.targets_missing_ids?.length) return "";
    return (
      planResult.targets_missing_ids
        .slice(0, 12)
        .map((id) => `${catNameById.get(id) ?? "?"}#${id}`)
        .join(", ") + (planResult.targets_missing_ids.length > 12 ? " ..." : "")
    );
  }, [planResult, catNameById]);

  const tierGroupsSorted = useMemo(() => {
    const gs = [...(tierGroups as TierGroup[])];
    gs.sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier));
    return gs;
  }, [tierGroups]);

  // 預留：圖片/連結
  const getCatHref = (catId: number) => undefined as string | undefined;
  const getCatImageUrl = (catId: number) => undefined as string | undefined;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            貓咪大戰爭抽卡規劃（測試版）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            流程：輸入 seed/count → 選卡池(多選) → 選目標貓咪(多選) → 輸入資源 →
            執行抽卡規劃
          </Typography>
        </Box>

        {/* Seed/Count */}
        {ui.showSeedCount && (
          <Section
            title="輸入seed/count、卡池"
            collapsed={ui.seedCountCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({
                ...p,
                seedCountCollapsed: !p.seedCountCollapsed,
              }))
            }
            onHide={() => setUi((p) => ({ ...p, showSeedCount: false }))}
          >
            <Stack spacing={0.5}>
              <SeedCountForm
                seedApplied={seedApplied}
                countApplied={countApplied}
                onChange={({ seed, count }) => {
                  setSeedApplied(seed);
                  setCountApplied(count);
                }}
              />

              <EventsPicker
                loadState={eventsState as LoadState}
                error={eventsErr}
                upcomingEvents={upcomingEvents}
                pastEvents={pastEvents}
                value={selectedEventValues}
                onChange={(next) => setSelectedEventValues(next)}
                primaryValue={primaryEventValue}
                onPrimaryChange={(v) => setPrimaryEventValue(v)}
              />
            </Stack>
          </Section>
        )}

        {/* Target Cats */}
        {ui.showTargetCats && (
          <Section
            title="選擇目標貓咪"
            collapsed={ui.targetCatsCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({
                ...p,
                targetCatsCollapsed: !p.targetCatsCollapsed,
              }))
            }
            onHide={() => setUi((p) => ({ ...p, showTargetCats: false }))}
          >
            <TargetCatsPicker
              loadState={catsState as LoadState}
              error={catsErr}
              groups={tierGroupsSorted}
              selectedIds={targetCatIds}
              onChange={setTargetCatIds}
              onClear={() => setTargetCatIds([])}
              getCatHref={getCatHref}
              getCatImageUrl={getCatImageUrl}
              minColWidth={220}
              dense
            />
          </Section>
        )}

        {/* Planner */}
        {ui.showPlanner && (
          <Section
            title="輸入資源"
            collapsed={ui.plannerCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({ ...p, plannerCollapsed: !p.plannerCollapsed }))
            }
            onHide={() => setUi((p) => ({ ...p, showPlanner: false }))}
          >
            <Stack spacing={2}>
              <ResourceForm
                value={resources}
                cfg={plannerCfg}
                onChange={setResources}
                onCfgChange={setPlannerCfg}
              />

              <PlannerRunBar
                state={planState as LoadState}
                onRun={onClickPlanner}
                disabled={
                  planState === "loading" ||
                  !selectedEventValues.length ||
                  !hasSeedCount ||
                  targetCatIds.length === 0
                }
                hint={
                  !selectedEventValues.length
                    ? "請先選至少一個 event"
                    : !hasSeedCount
                    ? "請先套用 seed / count"
                    : !targetCatIds.length
                    ? "請先選目標貓"
                    : ""
                }
                error={planState === "error" ? planErr : ""}
              />

              {planState === "ok" && planResult && (
                <Stack spacing={2}>
                  <PlanResultSummary
                    result={planResult as PlanResult}
                    missingText={missingText}
                  />
                  <PlanResultInspector
                    result={planResult as PlanResult}
                    catNameById={catNameById}
                  />
                  <PlanStepsTable
                    result={planResult as PlanResult}
                    getCatHref={getCatHref}
                    getCatImageUrl={getCatImageUrl}
                  />
                </Stack>
              )}
            </Stack>
          </Section>
        )}

        {/* Graph Debug（用 primary） */}
        {ui.showGraphDebug && (
          <Section
            title="TrackGraph Debug（主要 event）"
            collapsed={ui.graphDebugCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({
                ...p,
                graphDebugCollapsed: !p.graphDebugCollapsed,
              }))
            }
            onHide={() => setUi((p) => ({ ...p, showGraphDebug: false }))}
          >
            <GraphSummaryCard
              seedApplied={seedApplied}
              countApplied={countApplied}
              selectedEventValue={primaryEventValue}
              graphState={graphState as LoadState}
              graphErr={graphErr}
              graph={activeGraph}
            />
          </Section>
        )}

        {/* Simulator（用 primary） */}
        {ui.showSimulator && (
          <Section
            title="Simulator（主要 event；可隱藏）"
            collapsed={ui.simulatorCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({
                ...p,
                simulatorCollapsed: !p.simulatorCollapsed,
              }))
            }
            onHide={() => setUi((p) => ({ ...p, showSimulator: false }))}
          >
            <SimulatorPanel
              graph={activeGraph}
              graphReady={!!activeGraph && graphState === "ok"}
            />
          </Section>
        )}
      </Stack>
    </Container>
  );
}
