import type { FastifyInstance } from "fastify";
import listRemittanceLinesRoutes from "./list.js";
import recordRemittanceRoutes from "./record-remittance.js";
import netOffRoutes from "./net-off.js";

export default async function numbatrakRemittanceRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listRemittanceLinesRoutes);
  await app.register(recordRemittanceRoutes);
  await app.register(netOffRoutes);
}
