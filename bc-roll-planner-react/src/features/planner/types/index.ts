export type PlannerResources = {
  tickets: number;
  platinum_tickets: number;
  legend_tickets: number;
  food: number;
};

export type PlannerUiConfig = {
  start_pos_id: string;
  max_expansions: number;
};

export type PlannerStage = "input" | "results";

export type PlannerDraftInputs = {
  seed: string;
  countInput: string;
  resources: PlannerResources;
  cfg: PlannerUiConfig;
  selectedEventValues: string[];
  primaryEventValue: string;
  targetCatIds: number[];
};

export type PlannerAppliedInputs = PlannerDraftInputs & {
  resolvedCount: number;
  manualCount: number | null;
};

export type PlannerSessionState = {
  stage: PlannerStage;
  manualCountExpanded: boolean;
};
