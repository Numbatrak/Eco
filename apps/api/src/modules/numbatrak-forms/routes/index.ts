import type { FastifyInstance } from "fastify";
import listFormsRoutes from "./list.js";
import createFormRoutes from "./create.js";
import updateFormRoutes from "./update.js";
import deleteFormRoutes from "./delete.js";
import formWebhookSecretRoutes from "./webhook-secret.js";
import publicNumbatrakFormRoutes from "./public.js";
import publicNumbatrakFormWebhookRoutes from "./public-webhook.js";

export default async function numbatrakFormsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listFormsRoutes);
  await app.register(createFormRoutes);
  await app.register(updateFormRoutes);
  await app.register(deleteFormRoutes);
  await app.register(formWebhookSecretRoutes);
  await app.register(publicNumbatrakFormRoutes);
  await app.register(publicNumbatrakFormWebhookRoutes);
}
