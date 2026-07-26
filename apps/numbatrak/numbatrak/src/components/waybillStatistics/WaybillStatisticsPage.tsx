import { Navigate } from "react-router-dom";

/** @deprecated Use /delivery-analytics */
export function WaybillStatisticsPage() {
  return <Navigate to="/delivery-analytics" replace />;
}
