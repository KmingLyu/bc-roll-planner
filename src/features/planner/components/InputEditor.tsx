import { EventPicker } from "@/features/events";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_SELECTED_EVENTS } from "../logic/helpers";
import { usePlannerScreen } from "../PlannerPageContainer";
import { ResourceForm } from "./ResourceForm";
import { RunBar } from "./RunBar";
import { SeedForm } from "./SeedForm";
import { TargetPanel } from "./TargetPanel";

export function InputEditor({ layout }: { layout: "immersive" | "compact" }) {
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
    runDisabled,
    runHint,
    appliedSession,
    runPlannerFlow,
  } = usePlannerScreen();

  const content = (
    <>
      <div className="space-y-5">
        <SeedForm
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
            <EventPicker
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
            <TargetPanel />
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
