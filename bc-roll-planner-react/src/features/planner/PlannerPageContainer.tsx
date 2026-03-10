// src/features/planner/PlannerPageContainer.tsx
import { useEffect, useMemo, useState } from "react";

// MUI
import {
  Box,
  Container,
  Stack,
  Typography,
  Badge,
  IconButton,
  Tooltip,
  Fab,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import PetsIcon from "@mui/icons-material/Pets";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

// Models
import type { Event, TrackGraph } from "@/types/models";

// APIs
import { ApiError } from "@/lib/api-client";

// Hooks
import { EventsPicker, useEvents } from "@/features/events";
import { TargetCatsSelectionContent, useEventCats } from "@/features/cats";
import { useTrackGraphs } from "@/features/track-graph";
import { usePlannerWorker } from "./hooks/usePlannerWorker";

// Components
import { Section } from "@/components";
import { DisclaimerNote } from "./components/Note";
import { ResourceForm } from "./components/ResourceForm";
import { RunBar } from "./components/RunBar";
import { SeedCountForm } from "./components/SeedCountForm";
import { ResultStatsCard } from "./components/ResultStats";
import { ResultTable } from "./components/Results";
import { TargetCatsLayout } from "./components/TargetLayout";

// Planner types
import type { PlanResult } from "./logic/core";
import type { PlannerResources, PlannerUiConfig, UiFlags } from "./types";
import { parsePosId } from "@/utils/cursor";

// env
import { BC_ENV } from "@/config/bcEnv";

type LoadState = "idle" | "loading" | "ok" | "error";

function safeErrText(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (HTTP ${e.status})`;
  if (e && typeof e === "object" && "message" in e)
    return String((e as any).message);
  return String(e);
}

function clampNonNegativeInt(n: number): number {
  return Math.max(0, Math.floor(n || 0));
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
}): number {
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

  return getStartPosOffset(startPosId) + normalDepth + platinumDepth + legendDepth;
}

export function PlannerPageContainer() {
  const theme = useTheme();
  const isMdDown = useMediaQuery(theme.breakpoints.down("md"));

  // Drawer open 狀態（小螢幕用）
  const [targetCatsDrawerOpen, setTargetCatsDrawerOpen] = useState(false);

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

    showPlanner: false,
    plannerCollapsed: false,

    showPlannerResultSummary: true,
    plannerResultSummaryCollapsed: false,

    showPlannerResultTable: false,
    plannerResultTableCollapsed: false,

    showGraphDebug: false,
    graphDebugCollapsed: true,

    showSimulator: false,
    simulatorCollapsed: true,
  });

  // -------------------------
  // Seed/Count
  // -------------------------
  const [seedApplied, setSeedApplied] = useState<string>("");
  const [countInput, setCountInput] = useState<string>("");
  const [manualCount, setManualCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string>("");

  // -------------------------
  // Events
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

  // Map lookup
  const eventsByValue = useMemo(() => {
    const m = new Map<string, Event>();
    for (const e of events) m.set(e.value, e);
    return m;
  }, [events]);

  const hasSeed = useMemo(() => !!seedApplied.trim(), [seedApplied]);

  // -------------------------
  // Target Cats
  // -------------------------
  const { catsState, catsErr, tierGroups, allowedCatIdSet, catNameById } =
    useEventCats({
      selectedEventValues,
      eventsByValue,
      lang: BC_ENV.lang,
      ui: BC_ENV.ui,
    });

  const [targetCatIds, setTargetCatIds] = useState<number[]>([]);

  useEffect(() => {
    if (!allowedCatIdSet) return;
    setTargetCatIds((prev) => prev.filter((id) => allowedCatIdSet.has(id)));
  }, [allowedCatIdSet]);

  // -------------------------
  // Graphs
  // -------------------------
  const { graphState, graphErr, graphByEvent, fetchGraphs, clearGraphs } =
    useTrackGraphs({
      seed: seedApplied,
      selectedEventValues,
      eventsByValue,
      lang: BC_ENV.lang,
      ui: BC_ENV.ui,
    });

  const activeGraph: TrackGraph | null = useMemo(() => {
    if (!primaryEventValue) return null;
    return graphByEvent[primaryEventValue] ?? null;
  }, [graphByEvent, primaryEventValue]);

  // -------------------------
  // Planner resources + cfg
  // -------------------------
  const [resources, setResources] = useState<PlannerResources>({
    tickets: 0,
    platinum_tickets: 0,
    legend_tickets: 0,
    food: 0,
  });

  const [plannerCfg, setPlannerCfg] = useState<PlannerUiConfig>({
    start_pos_id: "1A",
    max_expansions: 200000,
  });

  const autoCount = useMemo(
    () =>
      estimateAutoCount({
        selectedEventValues,
        eventsByValue,
        resources,
        startPosId: plannerCfg.start_pos_id,
      }),
    [selectedEventValues, eventsByValue, resources, plannerCfg.start_pos_id]
  );

  // -------------------------
  // Planner worker
  // -------------------------
  const { runPlanner, setLoading, planState, planErr, planResult, resetPlan } =
    usePlannerWorker();

  useEffect(() => {
    clearGraphs();
    resetPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    seedApplied,
    countInput,
    selectedEventValues.join("|"),
    targetCatIds.join("|"),
    resources.tickets,
    resources.platinum_tickets,
    resources.legend_tickets,
    resources.food,
    plannerCfg.start_pos_id,
    plannerCfg.max_expansions,
  ]);

  async function onClickPlanner() {
    if (!selectedEventValues.length) {
      return runPlanner({ kind: "errorOnly", error: "請先選擇至少一個 event" });
    }
    if (!hasSeed) {
      return runPlanner({
        kind: "errorOnly",
        error: "請先在最上方輸入 seed",
      });
    }
    if (countError) {
      return runPlanner({ kind: "errorOnly", error: countError });
    }
    if (!targetCatIds.length) {
      return runPlanner({ kind: "errorOnly", error: "請先選至少一隻目標貓" });
    }

    const nextResolvedCount = manualCount ?? autoCount;
    if (!Number.isFinite(nextResolvedCount) || nextResolvedCount <= 0) {
      return runPlanner({
        kind: "errorOnly",
        error: "目前沒有可用資源可規劃",
      });
    }

    setLoading();

    let graphsByEvent: Record<string, TrackGraph>;
    try {
      graphsByEvent = await fetchGraphs(nextResolvedCount);
    } catch (e) {
      return runPlanner({
        kind: "errorOnly",
        error: `取得 TrackGraph 失敗：${safeErrText(e)}`,
      });
    }

    const primary =
      primaryEventValue && selectedEventValues.includes(primaryEventValue)
        ? primaryEventValue
        : selectedEventValues[0];

    const g = primary ? graphsByEvent[primary] : undefined;
    const ok = !!g && Object.keys(g.nodes ?? {}).length > 0;

    if (!ok) {
      return runPlanner({
        kind: "errorOnly",
        error: "主要 event 的 TrackGraph 不存在（可能抓取失敗或回傳為空）",
      });
    }

    runPlanner({
      kind: "run",
      req: {
        graphs_by_event: graphsByEvent,
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

  // 預留：圖片/連結
  const getCatHref = (catId: number) => undefined as string | undefined;
  const getCatImageUrl = (catId: number) => undefined as string | undefined;

  // 小螢幕：用 Drawer；大螢幕：右欄
  const shouldUseDrawer = isMdDown;
  const runDisabled =
    planState === "loading" ||
    !selectedEventValues.length ||
    !hasSeed ||
    !!countError ||
    targetCatIds.length === 0;

  const runHint = !selectedEventValues.length
    ? "請先選至少一個 event"
    : !hasSeed
      ? "請先輸入 seed"
      : countError
        ? "count 必須是正整數或留空改用自動搜尋上限"
        : !targetCatIds.length
          ? "請先選目標貓"
          : !countInput.trim() && autoCount <= 0
            ? "目前沒有可用資源可規劃"
            : "";

  return (
    <>
      <Stack
        spacing={2}
        sx={{
          width: "100%",
          backgroundColor: "#1E293B", // 比 #0B1220 淺很多
          color: "#E2E8F0",
          border: "1px solid #334155",
          borderRadius: 0,
          boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
        }}
      >
        <Stack
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ width: "100%" }}
          direction="row"
        >
          <Typography
            component="h1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: "-0.015em",
              fontSize: { xs: "1.35rem", sm: "1.75rem", md: "2rem" },
              display: "flex",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: 0.5,
            }}
          >
            <Box component="span" sx={{ color: "#60a8ffff" }}>
              貓咪大戰爭
            </Box>

            <Box component="span" sx={{ color: "#FBBF24", mx: 0.25 }}>
              ⦁
            </Box>

            <Box component="span" sx={{ color: "#E5E7EB" }}>
              抽卡規劃
            </Box>

            <Box
              component="span"
              sx={{
                ml: 0.75,
                px: 0.8,
                py: 0.2,
                borderRadius: 1.2, // 關閉圓角
                fontSize: { xs: "0.7rem", sm: "0.78rem" },
                fontWeight: 700,
                color: "#93C5FD",
                backgroundColor: "#172554",
                border: "1px solid #1D4ED8",
                lineHeight: 1.4,
              }}
            >
              測試版
            </Box>
          </Typography>

          {shouldUseDrawer && ui.showTargetCats && (
            <Tooltip title="打開目標貓列表">
              <IconButton
                onClick={() => setTargetCatsDrawerOpen(true)}
                sx={{
                  alignSelf: "center",
                  border: "1px solid #334155",
                  color: "#E2E8F0",
                  backgroundColor: "#111827",
                  borderRadius: 2, // 關閉圓角
                  transition: "all 0.2s ease",
                  "&:hover": {
                    backgroundColor: "#1F2937",
                    borderColor: "#475569",
                  },
                }}
              >
                <Badge
                  color="secondary"
                  badgeContent={targetCatIds.length}
                  overlap="circular"
                >
                  <PetsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        <DisclaimerNote
          textColor="#CBD5E1" // 內文：淺灰
          linkColor="#93C5FD" // 連結：淺藍
          fontSize="0.76rem"
        />
      </Stack>

      <Container
        maxWidth={false}
        disableGutters
        sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 1.5, md: 2 } }}
      >
        <Stack spacing={{ xs: 1.25, sm: 1.5, md: 2 }} sx={{ width: "100%" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                shouldUseDrawer || !ui.showTargetCats
                  ? "minmax(0, 1fr)"
                  : "minmax(0, 1fr) minmax(280px, 360px)",
              gap: { xs: 1.25, sm: 1.5, md: 2 },
              alignItems: "start",
            }}
          >
            <Stack direction="column" spacing={{ xs: 1.25, sm: 1.5 }}>
              {ui.showSeedCount && (
                <Section
                  title="輸入條件與資源"
                  variant="planner"
                  collapsed={ui.seedCountCollapsed}
                  // collapsible={true}
                  onToggleCollapsed={() =>
                    setUi((p) => ({
                      ...p,
                      seedCountCollapsed: !p.seedCountCollapsed,
                    }))
                  }
                  onHide={() => setUi((p) => ({ ...p, showSeedCount: false }))}
                >
                  <Stack spacing={0}>
                    <Stack spacing={1} sx={{ py: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Seed / Count
                      </Typography>
                      <SeedCountForm
                        seedApplied={seedApplied}
                        countInput={countInput}
                        autoCount={autoCount}
                        onChange={({
                          seed,
                          countInput,
                          manualCount,
                          countError,
                        }) => {
                          setSeedApplied(seed);
                          setCountInput(countInput);
                          setManualCount(manualCount);
                          setCountError(countError);
                        }}
                      />
                    </Stack>

                    <Stack spacing={1} sx={{ py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        可用資源
                      </Typography>
                      <ResourceForm
                        value={resources}
                        cfg={plannerCfg}
                        onChange={setResources}
                        onCfgChange={setPlannerCfg}
                      />
                    </Stack>

                    <Stack spacing={1} sx={{ py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        卡池選擇
                      </Typography>
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

                    <Box sx={{ pt: 1, pb: 0.5 }}>
                      <RunBar
                        state={planState as LoadState}
                        onRun={onClickPlanner}
                        disabled={runDisabled}
                        hint={runHint}
                        error={planState === "error" ? planErr : ""}
                      />
                    </Box>
                  </Stack>
                </Section>
              )}

              {ui.showPlannerResultSummary && (
                <Section
                  title="結果統計"
                  variant="planner"
                  collapsed={ui.plannerResultSummaryCollapsed}
                  onToggleCollapsed={() =>
                    setUi((p) => ({
                      ...p,
                      plannerResultSummaryCollapsed:
                        !p.plannerResultSummaryCollapsed,
                    }))
                  }
                  onHide={() =>
                    setUi((p) => ({ ...p, showPlannerResultSummary: false }))
                  }
                >
                  {planState === "ok" && (
                    <ResultStatsCard
                      result={planResult as PlanResult}
                      graphsByEvent={graphByEvent}
                      catNameById={catNameById}
                    />
                  )}
                </Section>
              )}

              {planResult && (
                <Section
                  title="規劃結果"
                  variant="planner"
                  collapsed={ui.plannerResultTableCollapsed}
                  headerBorderBottom="none"
                  onToggleCollapsed={() =>
                    setUi((p) => ({
                      ...p,
                      plannerResultTableCollapsed:
                        !p.plannerResultTableCollapsed,
                    }))
                  }
                >
                  <ResultTable
                    result={planResult as PlanResult}
                    graphsByEvent={graphByEvent}
                    targetCatIds={targetCatIds}
                    catNameById={catNameById}
                    showTitle={false}
                  />
                </Section>
              )}
            </Stack>

            {ui.showTargetCats && (
              <TargetCatsLayout
                isMobile={shouldUseDrawer}
                drawerOpen={targetCatsDrawerOpen}
                onCloseDrawer={() => setTargetCatsDrawerOpen(false)}
                onHideDesktop={() =>
                  setUi((p) => ({ ...p, showTargetCats: false }))
                }
              >
                <TargetCatsSelectionContent
                  loadState={catsState as LoadState}
                  error={catsErr}
                  groups={tierGroups}
                  selectedIds={targetCatIds}
                  onChange={setTargetCatIds}
                  onClear={() => setTargetCatIds([])}
                  getCatHref={getCatHref}
                  getCatImageUrl={getCatImageUrl}
                  minColWidth={130}
                  dense
                />
              </TargetCatsLayout>
            )}
          </Box>

          {/* 大螢幕右欄被隱藏時，提供快速打開入口 */}
          {!shouldUseDrawer && !ui.showTargetCats && (
            <Fab
              size="small"
              color="primary"
              onClick={() => setUi((p) => ({ ...p, showTargetCats: true }))}
              sx={{
                position: "fixed",
                right: 16,
                bottom: 16,
                zIndex: theme.zIndex.modal + 1,
              }}
            >
              <ChevronRightIcon />
            </Fab>
          )}
        </Stack>
      </Container>
    </>
  );
}
