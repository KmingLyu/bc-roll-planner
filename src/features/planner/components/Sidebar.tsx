import { Card, CardContent } from "@/components/ui/card";
import { usePlannerData, usePlannerSession } from "../context/usePlanner";
import { ResultSummary } from "./ResultSummary";
import { ResultSummaryHeader } from "./ResultSummaryHeader";

export function Sidebar() {
  const { appliedSession, goToInputStage } = usePlannerSession();
  const { catNameById } = usePlannerData();

  if (!appliedSession) return null;

  return (
    <Card className="workspace-pane sticky top-0 self-start border-border/55">
      <ResultSummaryHeader onReset={goToInputStage} />
      <CardContent className="subtle-scrollbar max-h-[calc(100vh-3rem)] overflow-y-auto">
        <ResultSummary
          result={appliedSession.result}
          graphsByEvent={appliedSession.graphsByEvent}
          catNameById={catNameById}
        />
      </CardContent>
    </Card>
  );
}
