import type { FastifyInstance } from "fastify";
import dashboardSummaryRoutes from "./summary.js";
import dashboardFilterOptionsRoutes from "./filter-options.js";
import deliveryRateByLocationRoutes from "./delivery-rate-by-location.js";
import deliveryAnalyticsHeadlineRoutes from "./delivery-analytics-headline.js";
import deliveryBreakdownRoutes from "./delivery-breakdown.js";
import dashboardAlertThresholdsRoutes from "./alert-thresholds.js";
import notificationSettingsRoutes from "./notification-settings.js";
import dailySummaryCronRoutes from "./daily-summary-cron.js";

export default async function numbatrakDashboardRoutes(app: FastifyInstance): Promise<void> {
  await app.register(dashboardSummaryRoutes);
  await app.register(dashboardFilterOptionsRoutes);
  await app.register(deliveryRateByLocationRoutes);
  await app.register(deliveryAnalyticsHeadlineRoutes);
  await app.register(deliveryBreakdownRoutes);
  await app.register(dashboardAlertThresholdsRoutes);
  await app.register(notificationSettingsRoutes);
  await app.register(dailySummaryCronRoutes);
}
