// src/pages/PlannerPage.tsx
import { useEffect, useMemo, useState } from "react";

// MUI
import { Box, Button, Container, Stack, Typography } from "@mui/material";

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
  // Seed/Count：按 Apply 才更新
  // -------------------------
  const [seedApplied, setSeedApplied] = useState<string>("1234");
  const [countApplied, setCountApplied] = useState<number>(120);

  // -------------------------
  // Events：先維持 mode 單一（未來再做 upcoming+past 同時顯示/無限載入）
  // -------------------------
  const [eventsMode, setEventsMode] = useState<"upcoming" | "past">("upcoming");
  const { eventsState, eventsErr, events, reloadEvents } = useEvents({
    type: eventsMode,
    limit: 60,
    lang: "tw",
    ui: "tw",
  });

  // ✅ 多選 values
  const [selectedEventValues, setSelectedEventValues] = useState<string[]>([]);

  // ✅ primary event：Graph Debug / Simulator 用
  const [primaryEventValue, setPrimaryEventValue] = useState<string>("");

  // // 初次載入 events 後：若都沒選，預設選第一個，並設為 primary
  // useEffect(() => {
  //   if (selectedEventValues.length) return;
  //   if (eventsState === "ok" && events.length && events[0]?.value) {
  //     const first = events[0].value;
  //     setSelectedEventValues([first]);
  //     setPrimaryEventValue(first);
  //   }
  // }, [eventsState, events, selectedEventValues.length]);

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

  const eventsByValue = useMemo(() => {
    const m = new Map<string, Event>();
    for (const e of events) m.set(e.value, e);
    return m;
  }, [events]);

  // -------------------------
  // Target Cats：依 seed/count + selectedEventValues 自動載入（多事件 union）
  // -------------------------
  const { catsState, catsErr, tierGroups, allowedCatIdSet, catNameById } =
    useEventCats({
      seed: seedApplied,
      count: countApplied,
      selectedEventValues,
      eventsByValue,
      lang: "tw",
      ui: "tw",
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
      count: countApplied,
      selectedEventValues,
      eventsByValue,
      lang: "tw",
      ui: "tw",
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
    if (
      !seedApplied.trim() ||
      !Number.isFinite(countApplied) ||
      countApplied <= 0
    ) {
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

    // ✅ 確保先抓到最新 graphs
    try {
      await fetchGraphs();
    } catch (e) {
      resetPlan();
      return runPlanner({
        kind: "errorOnly",
        error: `取得 TrackGraph 失敗：${safeErrText(e)}`,
      });
    }

    const graphsByEvent = { ...graphByEvent };

    // 基本保險：至少 primary 那個要存在（也讓 debug/sim 不會空）
    const primary = primaryEventValue || selectedEventValues[0];
    if (primary && !graphsByEvent[primary]) {
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
        events: selectedEventValues.map((ev) => ({
          event_value: ev,
          pool_type: "normal" as const,
        })),
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
            BC Roll Planner（Events 多選版）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            先套用 seed/count → 多選 events → 選目標貓（聯集）→
            規劃（會自動抓最新 TrackGraph）
          </Typography>
        </Box>

        {/* {ui.showControlPanel ? (
          <ControlPanel value={ui} onChange={setUi} />
        ) : (
          <Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setUi((p) => ({ ...p, showControlPanel: true }))}
            >
              顯示區塊開關面板
            </Button>
          </Box>
        )} */}

        {/* Seed/Count */}
        {ui.showSeedCount && (
          <Section
            title="Seed / Count（先套用）"
            collapsed={ui.seedCountCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({
                ...p,
                seedCountCollapsed: !p.seedCountCollapsed,
              }))
            }
            onHide={() => setUi((p) => ({ ...p, showSeedCount: false }))}
          >
            <SeedCountForm
              seedApplied={seedApplied}
              countApplied={countApplied}
              onApply={({ seed, count }) => {
                setSeedApplied(seed);
                setCountApplied(count);
              }}
            />
          </Section>
        )}

        {/* Events（多選 + primary） */}
        {ui.showEvents && (
          <Section
            title="Events（可多選；含主要 event）"
            collapsed={ui.eventsCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({ ...p, eventsCollapsed: !p.eventsCollapsed }))
            }
            onHide={() => setUi((p) => ({ ...p, showEvents: false }))}
          >
            <EventsPicker
              mode={eventsMode}
              onModeChange={(m) => {
                setEventsMode(m);
                reloadEvents(m);

                // 切換 mode 時不強制清空已選（但你也可以改成清空）
                // 這裡維持最少干預：保留 selectedEventValues
              }}
              loadState={eventsState as LoadState}
              error={eventsErr}
              events={events}
              value={selectedEventValues}
              onChange={(next) => setSelectedEventValues(next)}
              primaryValue={primaryEventValue}
              onPrimaryChange={(v) => setPrimaryEventValue(v)}
            />
          </Section>
        )}

        {/* Target Cats */}
        {ui.showTargetCats && (
          <Section
            title="Target Cats（多事件聯集）"
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
            title="Planner（按下會先抓最新 TrackGraph）"
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
                  !seedApplied.trim() ||
                  countApplied <= 0 ||
                  targetCatIds.length === 0
                }
                hint={
                  !selectedEventValues.length
                    ? "請先選至少一個 event"
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

        {/* 3) Simulator（用 primary） */}
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
