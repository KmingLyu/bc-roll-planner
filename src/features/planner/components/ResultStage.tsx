import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { usePlannerData, usePlannerSession } from "../context/usePlanner";
import { ResultSummary } from "./ResultSummary";
import type { ResultFilterMode } from "./ResultTable";
import { InputStage } from "./InputStage";
import { Sidebar } from "./Sidebar";
import { ResultView } from "./ResultView";
import { ResultSummaryHeader } from "./ResultSummaryHeader";

export function ResultStage() {
  const { appliedSession, goToInputStage } = usePlannerSession();
  const { catNameById } = usePlannerData();
  const [resultFilterMode, setResultFilterMode] =
    useState<ResultFilterMode>("all");

  if (!appliedSession) {
    return <InputStage />;
  }

  return (
    <div className="space-y-4">
      <div className="lg:hidden">
        <Card className="workspace-pane border-border/55">
          <ResultSummaryHeader onReset={goToInputStage} />
          <CardContent className="space-y-3">
            <ResultSummary
              result={appliedSession.result}
              graphsByEvent={appliedSession.graphsByEvent}
              catNameById={catNameById}
              compact
            />
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:grid lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[minmax(300px,320px)_minmax(0,1fr)]">
        <Sidebar />
        <ResultView
          filterMode={resultFilterMode}
          onFilterModeChange={setResultFilterMode}
        />
      </div>

      <div className="lg:hidden">
        <ResultView
          filterMode={resultFilterMode}
          onFilterModeChange={setResultFilterMode}
        />
      </div>
    </div>
  );
}
