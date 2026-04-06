import { usePlannerData, usePlannerSession } from "../context/usePlanner";
import { ResultTable, type ResultFilterMode } from "./ResultTable";

export function ResultsView(props: {
  filterMode: ResultFilterMode;
  onFilterModeChange: (next: ResultFilterMode) => void;
}) {
  const { filterMode, onFilterModeChange } = props;
  const { appliedSession } = usePlannerSession();
  const { catNameById } = usePlannerData();

  if (!appliedSession) return null;

  return (
    <div className="workspace-pane border-border/55">
      <ResultTable
        result={appliedSession.result}
        graphsByEvent={appliedSession.graphsByEvent}
        targetCatIds={appliedSession.inputs.targetCatIds}
        catNameById={catNameById}
        filterMode={filterMode}
        onFilterModeChange={onFilterModeChange}
      />
    </div>
  );
}
