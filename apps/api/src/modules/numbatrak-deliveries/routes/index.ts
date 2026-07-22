import type { FastifyInstance } from "fastify";
import listDeliveriesRoutes from "./list.js";
import createDeliveryRoutes from "./create.js";
import waybillBatchRoutes from "./waybill-batch.js";
import updateDeliveryRoutes from "./update.js";
import deleteDeliveryRoutes from "./delete.js";
import monthlySummaryRoutes from "./monthly-summary.js";

export default async function numbatrakDeliveriesRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listDeliveriesRoutes);
  await app.register(createDeliveryRoutes);
  await app.register(waybillBatchRoutes);
  await app.register(updateDeliveryRoutes);
  await app.register(deleteDeliveryRoutes);
  await app.register(monthlySummaryRoutes);
}
