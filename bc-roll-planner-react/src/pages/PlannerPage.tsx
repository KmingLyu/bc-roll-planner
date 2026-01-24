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
  Collapse,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import PetsIcon from "@mui/icons-material/Pets";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

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
import {
  ResourceForm,
  type PlannerResources,
  type PlannerConfig,
} from "../components/planner/ResourceForm";
import { PlannerRunBar } from "../components/planner/PlannerRunBar";

// ✅ New result UI
import { PlanResultStatsCard } from "../components/planner/PlanResultStatsCard";
import { ResultTable } from "../components/planner/ResultTable";

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
  // const shouldUseDrawer = true;

  // 主欄寬度：小螢幕永遠 100%；大螢幕依右欄顯示與否調整
  const mainMaxWidth = shouldUseDrawer
    ? "100%"
    : ui.showTargetCats
      ? "70%"
      : "100%";

  // 右側內容（共用：Drawer / 右欄）
  const targetCatsContent = (
    <Section
      title="選擇目標貓咪"
      collapsed={ui.targetCatsCollapsed}
      collapsible={false}
      onToggleCollapsed={() =>
        setUi((p) => ({
          ...p,
          targetCatsCollapsed: !p.targetCatsCollapsed,
        }))
      }
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
        minColWidth={100}
        dense
      />
    </Section>
  );

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      {/* 標題 + 小螢幕目標貓入口 */}
      <Stack
        spacing={1}
        alignItems={"flex-start"}
        padding={2}
        direction="row"
        justifyContent="space-between"
        sx={{ width: "100%", gap: 2 }}
      >
        <Typography variant="h4" fontWeight={800}>
          🐾 貓咪大戰爭抽卡規劃（測試版）
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

      {/* 內容 */}
      <Stack
        spacing={2}
        direction={"row"}
        alignItems="flex-start"
        justifyContent="center"
        sx={{ position: "relative" }}
      >
        {/* Left + Center: Controls + Planner */}
        <Stack
          direction="column"
          spacing={1}
          alignItems="flex-start"
          sx={{
            maxWidth: mainMaxWidth,
            maxHeight: "85vh",
            overflowY: "auto",
            flexGrow: 1,
            scrollbarGutter: "stable",
          }}
        >
          {/* Seed/Count + Events + 資源 */}
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

          {/* Result Summary*/}
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
                <Stack spacing={2}>
                  <PlanResultStatsCard
                    result={planResult as PlanResult}
                    graphsByEvent={graphByEvent}
                    catNameById={catNameById}
                  />
                </Stack>
              )}
            </Section>
          )}

          {/* Result Table（你原本就有直接顯示） */}
          {planResult && (
            <ResultTable
              result={planResult as PlanResult}
              graphsByEvent={graphByEvent}
              targetCatIds={targetCatIds}
            />
          )}
        </Stack>

        {/* 大螢幕：右欄用水平 Collapse，達成「從側邊縮進去」 */}
        {!shouldUseDrawer && (
          <>
            <Collapse
              in={ui.showTargetCats}
              orientation="horizontal"
              timeout={200}
              sx={{ alignSelf: "stretch" }}
            >
              <Box
                sx={{
                  width: 360,
                  minWidth: 210,
                  maxHeight: "85vh",
                  overflowY: "auto",
                }}
              >
                {targetCatsContent}
              </Box>
            </Collapse>

            {/* 右欄收合後，提供一顆浮動按鈕叫回來 */}
            {!ui.showTargetCats && (
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
          </>
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
