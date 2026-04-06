import { Card, CardContent } from "@/components/ui/card";
import { usePlannerScreen } from "../PlannerPageContainer";
import { ResultStatsSidebar } from "./ResultStats";
import { SummaryHeader } from "./SummaryHeader";

export function Sidebar() {
  const { appliedSession, catNameById, goToInputStage } = usePlannerScreen();

  if (!appliedSession) return null;

  return (
    <Card className="workspace-pane sticky top-0 self-start border-border/55">
      <SummaryHeader onReset={goToInputStage} />
      <CardContent className="subtle-scrollbar max-h-[calc(100vh-3rem)] overflow-y-auto">
        <ResultStatsSidebar
          result={appliedSession.result}
          graphsByEvent={appliedSession.graphsByEvent}
          catNameById={catNameById}
        />
      </CardContent>
    </Card>
  );
}
