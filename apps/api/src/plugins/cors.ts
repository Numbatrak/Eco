import fp from "fastify-plugin";
import cors from "@fastify/cors";

export default fp(async (app) => {
  await app.register(cors, {
    origin: process.env.PUBLIC_APP_URL ?? "http://localhost:3002",
    credentials: true,
  });
});
