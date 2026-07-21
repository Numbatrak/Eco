import type { FastifyInstance } from "fastify";
import listAgentsRoutes from "./list.js";
import createAgentRoutes from "./create.js";
import updateAgentRoutes from "./update.js";
import setAgentActiveRoutes from "./set-active.js";
import deleteAgentRoutes from "./delete.js";

export default async function numbatrakAgentsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listAgentsRoutes);
  await app.register(createAgentRoutes);
  await app.register(updateAgentRoutes);
  await app.register(setAgentActiveRoutes);
  await app.register(deleteAgentRoutes);
}
