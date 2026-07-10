import type { FastifyInstance } from "fastify";
import { updateFeatureFlagRequestSchema } from "@platform/shared-types";
import { listFeatureFlags, upsertFeatureFlag } from "../lib/feature-flags-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

export default async function featureFlagsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/platform-admin/feature-flags",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      return reply.send({ featureFlags: await listFeatureFlags(db) });
    },
  );

  app.patch<{ Params: { key: string } }>(
    "/platform-admin/feature-flags/:key",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = updateFeatureFlagRequestSchema.parse(request.body);
      const db = app.getDb();
      const flag = await upsertFeatureFlag(db, {
        key: request.params.key,
        enabled: body.enabled,
        description: body.description,
      });
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "feature_flag_updated",
        targetType: "feature_flag",
        targetId: request.params.key,
        details: { enabled: body.enabled },
      });
      return reply.send(flag);
    },
  );
}
