// src/pages/PlannerPage.tsx
import { useEffect, useMemo, useState } from "react";

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

// -------------------------
// Shared UI types
// -------------------------
type LoadState = "idle" | "loading" | "ok" | "error";

function tierOrder(t: CatTier): number {
  // Legendary > Uber > Super > Rare
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
  // UI flags（每個大區塊可獨立顯示/隱藏）
  // -------------------------
  const [ui, setUi] = useState<UiFlags>({
    showControlPanel: true,

    showSeedCount: true,
    seedCountCollapsed: false,

    showEvents: true,
    eventsCollapsed: false,

    showTargetCats: true,
    targetCatsCollapsed: false,

    showPlanner: true,
    plannerCollapsed: false,

    showGraphDebug: true,
    graphDebugCollapsed: true,

    showSimulator: true,
    simulatorCollapsed: true,
  });

  // -------------------------
  // Seed/Count：輸入中不影響全域；按 Apply 才更新
  // -------------------------
  const [seedApplied, setSeedApplied] = useState<string>("1234");
  const [countApplied, setCountApplied] = useState<number>(120);

  // -------------------------
  // Events（暫時維持原樣：upcoming/past 單選）
  // 但 value 先用 string[]，未來多選直接啟用
  // -------------------------
  const [eventsMode, setEventsMode] = useState<"upcoming" | "past">("upcoming");
  const { eventsState, eventsErr, events, reloadEvents } = useEvents({
    type: eventsMode,
    limit: 60,
    lang: "tw",
    ui: "tw",
  });

  const [selectedEventValues, setSelectedEventValues] = useState<string[]>([]);
  const selectedEventValue = selectedEventValues[0] ?? "";

  // 初次載入 events 後，自動選第一個（若尚未選）
  useEffect(() => {
    if (selectedEventValues.length) return;
    if (eventsState === "ok" && events.length && events[0]?.value) {
      setSelectedEventValues([events[0].value]);
    }
  }, [eventsState, events, selectedEventValues.length]);

  const eventsByValue = useMemo(() => {
    const m = new Map<string, Event>();
    for (const e of events) m.set(e.value, e);
    return m;
  }, [events]);

  // -------------------------
  // Target Cats：依 seedApplied/countApplied + selectedEventValues 自動載入
  // 未來多事件 -> 直接 union
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

  // 修剪：把已選但不在聯集清單內的移掉
  useEffect(() => {
    if (!allowedCatIdSet) return;
    setTargetCatIds((prev) => prev.filter((id) => allowedCatIdSet.has(id)));
  }, [allowedCatIdSet]);

  // -------------------------
  // Graph：按 Planner 前先 ensure 最新（你要求）
  // Graph Debug 區可以看目前狀態
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

  // 當 seed/count apply 或 events 變動：把舊 graph 清掉（避免誤用舊資料）
  useEffect(() => {
    clearGraphs();
  }, [seedApplied, countApplied, selectedEventValues.join("|")]);

  const activeGraph: TrackGraph | null = useMemo(() => {
    if (!selectedEventValue) return null;
    return graphByEvent[selectedEventValue] ?? null;
  }, [graphByEvent, selectedEventValue]);

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
  // Planner run (Worker)
  // -------------------------
  const { runPlanner, planState, planErr, planResult, resetPlan } =
    usePlannerWorker();

  // 只要資源改了就清結果（避免誤解）
  useEffect(() => {
    resetPlan();
  }, [resources, plannerCfg.start_pos_id, plannerCfg.max_expansions]);

  // -------------------------
  // 主流程：按下「規劃」-> 先抓最新 graph -> 再 run worker
  // -------------------------
  async function onClickPlanner() {
    // 1) basic guards
    if (!selectedEventValue) {
      resetPlan();
      return runPlanner({
        kind: "errorOnly",
        error: "請先選擇 event",
      });
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
      return runPlanner({
        kind: "errorOnly",
        error: "請先選至少一隻目標貓",
      });
    }

    // 2) ensure graphs
    try {
      await fetchGraphs(); // 會抓 selectedEventValues 的 graph
    } catch (e) {
      resetPlan();
      return runPlanner({
        kind: "errorOnly",
        error: `取得 TrackGraph 失敗：${safeErrText(e)}`,
      });
    }

    const graphsByEvent = { ...graphByEvent };
    // fetchGraphs() async 完成後，hook 內 state 已更新；但為保險再讀一次 activeGraph
    const g = graphsByEvent[selectedEventValue] ?? activeGraph;
    if (!g) {
      resetPlan();
      return runPlanner({
        kind: "errorOnly",
        error: "TrackGraph 不存在（可能抓取失敗或回傳為空）",
      });
    }

    // 3) run planner worker
    runPlanner({
      kind: "run",
      req: {
        graphs_by_event: graphsByEvent,
        // 目前先單 event + normal pool（未來支援多 event 時，直接把 selectedEventValues map 出來）
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

  // -------------------------
  // Derived for result UI
  // -------------------------
  const plannerOk = planState === "ok" && !!planResult;

  // 給結果顯示：缺少目標 id -> 名稱
  const missingText = useMemo(() => {
    if (!planResult?.targets_missing_ids?.length) return "";
    return (
      planResult.targets_missing_ids
        .slice(0, 12)
        .map((id) => `${catNameById.get(id) ?? "?"}#${id}`)
        .join(", ") + (planResult.targets_missing_ids.length > 12 ? " ..." : "")
    );
  }, [planResult, catNameById]);

  // -------------------------
  // Render
  // -------------------------
  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <h2 style={{ margin: "0 0 12px 0" }}>BC Roll Planner（重構版）</h2>

      {ui.showControlPanel && <ControlPanel value={ui} onChange={setUi} />}

      {/* 0) Seed / Count */}
      {ui.showSeedCount && (
        <Section
          title="0) Seed / Count（先套用，再進行後續）"
          collapsed={ui.seedCountCollapsed}
          onToggleCollapsed={() =>
            setUi((p) => ({ ...p, seedCountCollapsed: !p.seedCountCollapsed }))
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
          <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
            目前套用：seed=<b>{seedApplied}</b>，count=<b>{countApplied}</b>
          </div>
        </Section>
      )}

      {/* 1) Events */}
      {ui.showEvents && (
        <Section
          title="1) Events（目前單選；未來可多選 + both + infinite scroll）"
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
            }}
            loadState={eventsState}
            error={eventsErr}
            events={events}
            value={selectedEventValues}
            onChange={(next) => setSelectedEventValues(next)}
          />
        </Section>
      )}

      {/* 1.5) Target Cats */}
      {ui.showTargetCats && (
        <Section
          title="1.5) Target Cats（聯集可擴充；可折疊/內捲軸）"
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
            groups={tierGroups as TierGroup[]}
            selectedIds={targetCatIds}
            onChange={setTargetCatIds}
            onClear={() => setTargetCatIds([])}
            maxHeight={340}
          />
        </Section>
      )}

      {/* 2) Planner */}
      {ui.showPlanner && (
        <Section
          title="2) Planner（按下會先抓最新 TrackGraph）"
          collapsed={ui.plannerCollapsed}
          onToggleCollapsed={() =>
            setUi((p) => ({ ...p, plannerCollapsed: !p.plannerCollapsed }))
          }
          onHide={() => setUi((p) => ({ ...p, showPlanner: false }))}
        >
          <ResourceForm
            value={resources}
            cfg={plannerCfg}
            onChange={setResources}
            onCfgChange={setPlannerCfg}
          />

          <div style={{ marginTop: 10 }}>
            <PlannerRunBar
              state={planState as LoadState}
              onRun={onClickPlanner}
              disabled={
                planState === "loading" ||
                !selectedEventValue ||
                !seedApplied.trim() ||
                countApplied <= 0 ||
                targetCatIds.length === 0
              }
              hint={
                !selectedEventValue
                  ? "請先選 event"
                  : !targetCatIds.length
                  ? "請先選目標貓"
                  : ""
              }
            />
          </div>

          {planState === "error" && (
            <div style={{ marginTop: 10, color: "crimson" }}>
              planner 錯誤：{planErr}
            </div>
          )}

          {planState === "loading" && (
            <div style={{ marginTop: 10, opacity: 0.75 }}>規劃中...</div>
          )}

          {plannerOk && (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <PlanResultSummary
                result={planResult as PlanResult}
                missingText={missingText}
              />

              <PlanResultInspector
                result={planResult as PlanResult}
                catNameById={catNameById}
                // 先骨架：未來你要做「在哪個位置命中目標」、「每步資源消耗」、「使用哪些卡池」
              />

              <PlanStepsTable result={planResult as PlanResult} />
            </div>
          )}
        </Section>
      )}

      {/* 2.2) Graph Debug */}
      {ui.showGraphDebug && (
        <Section
          title="2.2) TrackGraph Debug（可隱藏）"
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
            selectedEventValue={selectedEventValue}
            graphState={graphState as LoadState}
            graphErr={graphErr}
            graph={activeGraph}
          />
        </Section>
      )}

      {/* 3) Simulator */}
      {ui.showSimulator && (
        <Section
          title="3) Simulator（可隱藏；不影響 Planner）"
          collapsed={ui.simulatorCollapsed}
          onToggleCollapsed={() =>
            setUi((p) => ({ ...p, simulatorCollapsed: !p.simulatorCollapsed }))
          }
          onHide={() => setUi((p) => ({ ...p, showSimulator: false }))}
        >
          <SimulatorPanel
            graph={activeGraph}
            graphReady={!!activeGraph && graphState === "ok"}
          />
        </Section>
      )}
    </div>
  );
}
