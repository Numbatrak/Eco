import type { FastifyInstance } from "fastify";
import { paginationQuerySchema } from "@platform/shared-types";

export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (request) => {
    // Validated against a real @platform/shared-types schema to prove the
    // workspace import resolves correctly end to end.
    paginationQuerySchema.parse(request.query ?? {});
    return { status: "ok" };
  });
}
