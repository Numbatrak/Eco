import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DateFilter } from "../utils/dateRange";
import type { DashboardMetricsScope } from "../services/dashboardMetrics";
import type { DashboardViewMode } from "../types/dashboardFilters";

export type DashboardAlertsContextState = {
  dateFilter: DateFilter;
  scope: DashboardMetricsScope;
  viewMode: DashboardViewMode;
};

const DEFAULT_STATE: DashboardAlertsContextState = {
  dateFilter: { type: "this_month" },
  scope: {},
  viewMode: "business",
};

type DashboardAlertsContextValue = DashboardAlertsContextState & {
  setDashboardAlertContext: (patch: Partial<DashboardAlertsContextState>) => void;
};

const DashboardAlertsContext = createContext<DashboardAlertsContextValue | null>(
  null
);

export function DashboardAlertsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardAlertsContextState>(DEFAULT_STATE);

  const setDashboardAlertContext = useCallback(
    (patch: Partial<DashboardAlertsContextState>) => {
      setState((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const value = useMemo(
    () => ({ ...state, setDashboardAlertContext }),
    [state, setDashboardAlertContext]
  );

  return (
    <DashboardAlertsContext.Provider value={value}>
      {children}
    </DashboardAlertsContext.Provider>
  );
}

export function useDashboardAlertsContext(): DashboardAlertsContextValue {
  const ctx = useContext(DashboardAlertsContext);
  if (!ctx) {
    return {
      ...DEFAULT_STATE,
      setDashboardAlertContext: () => {},
    };
  }
  return ctx;
}
