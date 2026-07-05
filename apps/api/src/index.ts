import Fastify from "fastify";
import dbPlugin from "./plugins/db.js";
import healthRoutes from "./routes/health.js";

const app = Fastify({ logger: true });

await app.register(dbPlugin);
await app.register(healthRoutes);

const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
