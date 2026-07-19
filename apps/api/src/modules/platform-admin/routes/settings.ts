import type { FastifyInstance } from "fastify";
import { updatePlatformSettingRequestSchema } from "@platform/shared-types";
import { listPlatformSettings, upsertPlatformSetting } from "../lib/platform-settings-admin.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

export default async function platformSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/platform-admin/settings",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      return reply.send({ settings: await listPlatformSettings(db) });
    },
  );

  app.patch<{ Params: { key: string } }>(
    "/platform-admin/settings/:key",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = updatePlatformSettingRequestSchema.parse(request.body);
      const db = app.getDb();
      const setting = await upsertPlatformSetting(db, { key: request.params.key, value: body.value });
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "platform_setting_updated",
        targetType: "platform_setting",
        targetId: request.params.key,
        details: { value: body.value },
      });
      return reply.send(setting);
    },
  );
}
