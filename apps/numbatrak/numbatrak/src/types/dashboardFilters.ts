/** Shared dashboard filter state (UI + metrics queries). */
export type DashboardViewMode = "funnel" | "business";

export type DashboardFilterState = {
  dateFilter: {
    type: "all" | "today" | "this_week" | "this_month" | "custom";
    startDate?: string;
    endDate?: string;
  };
  formId?: string | null;
  csrId?: string | null;
  funnelName?: string | null;
  subBrand?: string | null;
  agentId?: number | null;
  status?: string | null;
  viewMode?: DashboardViewMode;
};

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterState = {
  dateFilter: { type: "all" },
  viewMode: "business",
};
