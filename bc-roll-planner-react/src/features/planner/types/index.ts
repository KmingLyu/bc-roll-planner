export type UiFlags = {
  showControlPanel: boolean;

  showSeedCount: boolean;
  seedCountCollapsed: boolean;

  showEvents: boolean;
  eventsCollapsed: boolean;

  showTargetCats: boolean;
  targetCatsCollapsed: boolean;

  showPlanner: boolean;
  plannerCollapsed: boolean;

  showPlannerResultSummary: boolean;
  plannerResultSummaryCollapsed: boolean;

  showPlannerResultTable: boolean;
  plannerResultTableCollapsed: boolean;

  showGraphDebug: boolean;
  graphDebugCollapsed: boolean;

  showSimulator: boolean;
  simulatorCollapsed: boolean;
};

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

