import { Container, Typography } from "@mui/material";
import { useHomeController } from "../hooks/useHomeController";

import { EventsSection } from "../features/events/EventsSection";
import { TargetCatsSection } from "../features/targetCats/TargetCatsSection";
import { TrackGraphSection } from "../features/trackGraph/TrackGraphSection";
import { SimulatorSection } from "../features/simulator/SimulatorSection";
import { PlannerSection } from "../features/planner/PlannerSection";

export default function HomePage() {
  const c = useHomeController();

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        BC Roll Planner v1（Refactor）
      </Typography>

      <EventsSection
        eventsType={c.eventsType}
        loadState={c.eventsState}
        events={c.events}
        error={c.eventsErr}
        selectedEventValues={c.selectedEventValues}
        onChangeType={c.setEventsType}
        onChangeSelected={c.setSelectedEventValues}
        onReload={c.reloadEvents}
      />

      <TargetCatsSection
        loadState={c.catsState}
        groups={c.catGroups}
        error={c.catsErr}
        selectedIds={c.targetCatIds}
        onChangeSelected={c.setTargetCatIds}
        onClear={() => c.setTargetCatIds([])}
      />

      <TrackGraphSection
        seed={c.seed}
        count={c.count}
        activeEventValue={c.activeEventValue}
        onChangeSeed={c.setSeed}
        onChangeCount={c.setCount}
        onChangeEventValue={(v) => c.setSelectedEventValues(v ? [v] : [])}
        loadState={c.graphState}
        graph={c.graph}
        error={c.graphErr}
        onFetch={c.fetchGraphManual}
        showRaw={c.showGraphRaw}
        onToggleRaw={c.setShowGraphRaw}
      />

      <PlannerSection
        disabled={c.planState === "loading"}
        loadState={c.planState}
        error={c.planErr}
        resources={c.resources}
        onChangeResources={(next) =>
          c.setResources((prev) => ({ ...prev, ...next }))
        }
        onRun={c.runPlanner}
        result={c.planResult}
        catNameById={c.catNameById}
        showRaw={c.showPlanRaw}
        onToggleRaw={c.setShowPlanRaw}
      />

      <SimulatorSection
        disabled={!c.graphReady()}
        cursorId={c.sim.cursorId}
        prevCatId={c.sim.prevCatId}
        recordsCount={c.sim.records.length}
        text={c.sim.text}
        onSingle={() => {
          if (c.graph && c.graphReady()) c.sim.append("single", c.graph);
        }}
        onTen={() => {
          if (c.graph && c.graphReady()) c.sim.append("ten", c.graph);
        }}
        onReset={c.sim.reset}
      />
    </Container>
  );
}
