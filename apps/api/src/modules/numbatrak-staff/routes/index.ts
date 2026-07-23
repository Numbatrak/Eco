import type { FastifyInstance } from "fastify";
import listStaffRoutes from "./list.js";
import eligibleMembersRoutes from "./eligible-members.js";
import createStaffRoutes from "./create.js";
import updateStaffRoutes from "./update.js";
import setStaffActiveRoutes from "./set-active.js";

export default async function numbatrakStaffRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listStaffRoutes);
  await app.register(eligibleMembersRoutes);
  await app.register(createStaffRoutes);
  await app.register(updateStaffRoutes);
  await app.register(setStaffActiveRoutes);
}
