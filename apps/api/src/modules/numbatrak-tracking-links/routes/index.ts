import type { FastifyInstance } from "fastify";
import {
  createNumbatrakTrackingLinkRequestSchema,
  updateNumbatrakTrackingLinkRequestSchema,
  listNumbatrakTrackingLinksQuerySchema,
} from "@platform/shared-types";
import { listTrackingLinks, createTrackingLink, updateTrackingLink } from "../lib/tracking-links.js";

export default async function numbatrakTrackingLinksRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/tracking-links",
    { preHandler: app.requireOrgPermission({ numbatrakTrackingLinks: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const query = listNumbatrakTrackingLinksQuerySchema.parse(request.query);
      return reply.send({ trackingLinks: await listTrackingLinks(db, organizationId, query) });
    },
  );

  app.post(
    "/org/numbatrak/tracking-links",
    { preHandler: app.requireOrgPermission({ numbatrakTrackingLinks: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = createNumbatrakTrackingLinkRequestSchema.parse(request.body);
      return reply.status(201).send(await createTrackingLink(db, organizationId, body));
    },
  );

  app.patch<{ Params: { trackingLinkId: string } }>(
    "/org/numbatrak/tracking-links/:trackingLinkId",
    { preHandler: app.requireOrgPermission({ numbatrakTrackingLinks: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = updateNumbatrakTrackingLinkRequestSchema.parse(request.body);
      const result = await updateTrackingLink(db, organizationId, request.params.trackingLinkId, body);
      if (!result) return reply.status(404).send({ error: "Tracking link not found" });
      return reply.send(result);
    },
  );
}
