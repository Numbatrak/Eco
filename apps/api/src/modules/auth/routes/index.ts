import type { FastifyInstance } from "fastify";
import registerRoutes from "./register.js";
import loginRoutes from "./login.js";
import refreshRoutes from "./refresh.js";
import logoutRoutes from "./logout.js";
import logoutAllRoutes from "./logout-all.js";
import passwordResetRoutes from "./password-reset.js";

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  await app.register(registerRoutes);
  await app.register(loginRoutes);
  await app.register(refreshRoutes);
  await app.register(logoutRoutes);
  await app.register(logoutAllRoutes);
  await app.register(passwordResetRoutes);
}
