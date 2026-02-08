// src/pages/PlannerPage.tsx
import { useEffect, useMemo, useState } from "react";

// MUI
import {
  Box,
  Container,
  Stack,
  Typography,
  Drawer,
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
import type { Event, TrackGraph } from "@/shared/models";

// APIs
import { ApiError } from "@/shared/api/netlifyClient";

// Hooks
import { useEvents } from "@/features/events/model/useEvents";
import {
  useEventCats,
  type TierGroup,
  type CatTier,
} from "@/features/cats/model/useEventCats";
import { useTrackGraphs } from "@/features/track-graph/model/useTrackGraphs";
import { usePlannerWorker } from "@/features/planner/model/usePlannerWorker";

// Components
import { Section } from "@/shared/ui/Section";
import type { UiFlags } from "@/shared/ui/ControlPanel";
import { DataSourceDisclaimerNote } from "@/shared/ui/DataSourceDisclaimerNote";
import { SeedCountForm } from "@/features/planner/ui/SeedCountForm";
import { EventsPicker } from "@/features/events/ui/EventsPicker";
import { TargetCatsPicker } from "@/features/cats/ui/TargetCatsPicker";
import {
  ResourceForm,
  type PlannerResources,
  type PlannerConfig,
} from "@/features/planner/ui/ResourceForm";
import { PlannerRunBar } from "@/features/planner/ui/PlannerRunBar";

// ✅ New result UI
import { PlanResultStatsCard } from "@/features/planner/ui/PlanResultStatsCard";
import { ResultTable } from "@/features/planner/ui/ResultTable";

// Planner types
import type { PlanResult } from "@/domain/planner";

// env
import { BC_ENV } from "@/shared/config/bcEnv";

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
  const [countApplied, setCountApplied] = useState<number | null>(null);

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

  const hasSeedCount = useMemo(() => {
    const okSeed = !!seedApplied.trim();
    const okCount =
      typeof countApplied === "number" &&
      Number.isFinite(countApplied) &&
      countApplied > 0;
    return okSeed && okCount;
  }, [seedApplied, countApplied]);

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
      count: countApplied,
      selectedEventValues,
      eventsByValue,
      lang: BC_ENV.lang,
      ui: BC_ENV.ui,
    });

  useEffect(() => {
    clearGraphs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedApplied, countApplied, selectedEventValues.join("|")]);

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

  const [plannerCfg, setPlannerCfg] = useState<PlannerConfig>({
    start_pos_id: "1A",
    max_expansions: 200000,
  });

  // -------------------------
  // Planner worker
  // -------------------------
  const { runPlanner, setLoading, planState, planErr, planResult, resetPlan } =
    usePlannerWorker();

  async function onClickPlanner() {
    if (!selectedEventValues.length) {
      return runPlanner({ kind: "errorOnly", error: "請先選擇至少一個 event" });
    }
    if (!hasSeedCount) {
      return runPlanner({
        kind: "errorOnly",
        error: "請先在最上方套用 seed / count（count 必須為正整數）",
      });
    }
    if (!targetCatIds.length) {
      return runPlanner({ kind: "errorOnly", error: "請先選至少一隻目標貓" });
    }

    setLoading();

    let graphsByEvent: Record<string, TrackGraph>;
    try {
      graphsByEvent = await fetchGraphs();
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

  const tierGroupsSorted = useMemo(() => {
    const gs = [...(tierGroups as TierGroup[])];
    gs.sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier));
    return gs;
  }, [tierGroups]);

  // 預留：圖片/連結
  const getCatHref = (catId: number) => undefined as string | undefined;
  const getCatImageUrl = (catId: number) => undefined as string | undefined;

  // 小螢幕：用 Drawer；大螢幕：右欄
  const shouldUseDrawer = isMdDown;

  // 右側內容（共用：Drawer / 右欄）
  const targetCatsContent = (
    <Section
      title="選擇目標貓咪"
      collapsed={ui.targetCatsCollapsed}
      collapsible={false}
      onHide={() => {
        setUi((p) => ({ ...p, showTargetCats: false }));
        setTargetCatsDrawerOpen(false);
      }}
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
        minColWidth={130}
        dense
      />
    </Section>
  );

  return (
    <Container
      maxWidth={false}
      disableGutters
      sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 1.5, md: 2 } }}
    >
      <Stack spacing={{ xs: 1.25, sm: 1.5, md: 2 }} sx={{ width: "100%" }}>
        <Stack
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ width: "100%" }}
          direction="row"
        >
          <Typography
            variant="h6"
            component="h1"
            sx={{ fontWeight: 800, lineHeight: 1.2 }}
          >
            貓咪大戰爭抽卡規劃（測試版）
          </Typography>

          {/* 小螢幕：用按鈕打開 Drawer */}
          {shouldUseDrawer && ui.showTargetCats && (
            <Tooltip title="打開目標貓列表">
              <IconButton
                onClick={() => setTargetCatsDrawerOpen(true)}
                sx={{
                  alignSelf: "center",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
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

        <DataSourceDisclaimerNote />

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
                <Stack spacing={1.5}>
                  <SeedCountForm
                    seedApplied={seedApplied}
                    countApplied={countApplied}
                    onChange={({ seed, count }) => {
                      setSeedApplied(seed);
                      setCountApplied(count);
                    }}
                  />

                  <ResourceForm
                    value={resources}
                    cfg={plannerCfg}
                    onChange={setResources}
                    onCfgChange={setPlannerCfg}
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
                </Stack>
              </Section>
            )}

            {ui.showPlannerResultSummary && (
              <Section
                title="結果統計"
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
                  <PlanResultStatsCard
                    result={planResult as PlanResult}
                    graphsByEvent={graphByEvent}
                    catNameById={catNameById}
                  />
                )}
              </Section>
            )}

            {planResult && (
              <ResultTable
                result={planResult as PlanResult}
                graphsByEvent={graphByEvent}
                targetCatIds={targetCatIds}
              />
            )}
          </Stack>

          {!shouldUseDrawer && ui.showTargetCats && (
            <Box
              sx={{
                position: "sticky",
                top: 12,
                maxHeight: "calc(100vh - 24px)",
                overflowY: "auto",
              }}
            >
              {targetCatsContent}
            </Box>
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

        {/* 小螢幕：Drawer 從右側滑入 */}
        {shouldUseDrawer && ui.showTargetCats && (
          <Drawer
            anchor="right"
            open={targetCatsDrawerOpen}
            onClose={() => setTargetCatsDrawerOpen(false)}
            ModalProps={{ keepMounted: true }} // 手機效能較佳
            PaperProps={{
              sx: {
                width: "min(92vw, 380px)",
                p: 1,
              },
            }}
          >
            <Box sx={{ height: "100%", overflowY: "auto" }}>
              {targetCatsContent}
            </Box>
          </Drawer>
        )}
      </Stack>
    </Container>
  );
}
