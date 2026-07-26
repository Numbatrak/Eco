import type { FastifyInstance } from "fastify";
import dashboardSummaryRoutes from "./summary.js";
import dashboardFilterOptionsRoutes from "./filter-options.js";
import deliveryRateByLocationRoutes from "./delivery-rate-by-location.js";

export default async function numbatrakDashboardRoutes(app: FastifyInstance): Promise<void> {
  await app.register(dashboardSummaryRoutes);
  await app.register(dashboardFilterOptionsRoutes);
  await app.register(deliveryRateByLocationRoutes);
}
