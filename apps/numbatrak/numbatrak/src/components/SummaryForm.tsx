import { Navigate } from "react-router-dom";

/** @deprecated Use /delivery-analytics — redirects legacy /summary and /reports routes */
export default function SummaryForm() {
  return <Navigate to="/delivery-analytics" replace />;
}

export { MonthlySummarySection } from "./deliveries/MonthlySummarySection";
