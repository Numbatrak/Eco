import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { updateNumbatrakStaffRequestSchema, updateNumbatrakStaffBankDetailsRequestSchema } from "@platform/shared-types";
import { auth } from "../../../lib/auth.js";
import { updateStaff, updateOwnBankDetails } from "../lib/staff.js";

export default async function updateStaffRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { staffId: string } }>(
    "/org/numbatrak/staff/:staffId",
    { preHandler: app.requireOrgPermission({ numbatrakStaff: ["manage"] }) },
    async (request, reply) => {
      const body = updateNumbatrakStaffRequestSchema.parse(request.body);
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      try {
        const staff = await updateStaff(
          db,
          request.activeOrganizationId!,
          request.params.staffId,
          body,
          session?.user.id ?? null,
        );
        if (!staff) {
          return reply.code(404).send({ error: "Staff record not found" });
        }
        return reply.send(staff);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Failed to update staff record" });
      }
    },
  );

  // Self-service: any org member with a staff record can update their own
  // bank details - gated on "view" (which every role has) rather than
  // "manage", since this only ever touches the caller's own row.
  app.patch(
    "/org/numbatrak/staff/me/bank-details",
    { preHandler: app.requireOrgPermission({ numbatrakStaff: ["view"] }) },
    async (request, reply) => {
      const body = updateNumbatrakStaffBankDetailsRequestSchema.parse(request.body);
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const staff = await updateOwnBankDetails(db, request.activeOrganizationId!, session.user.id, body);
      if (!staff) return reply.code(404).send({ error: "No staff record found for you in this organization" });
      return reply.send(staff);
    },
  );
}
