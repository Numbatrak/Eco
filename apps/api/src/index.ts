import Fastify from "fastify";
import dbPlugin from "./plugins/db.js";
import redisPlugin from "./plugins/redis.js";
import authenticatePlugin from "./plugins/authenticate.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./modules/auth/routes/index.js";
import mfaRoutes from "./modules/auth/mfa/routes/index.js";

const app = Fastify({ logger: true });

await app.register(dbPlugin);
await app.register(redisPlugin);
await app.register(authenticatePlugin);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(mfaRoutes);

const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
