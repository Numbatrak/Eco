import { and, eq } from "drizzle-orm";
import { member, user, type Database } from "@platform/db";

/** The org owner's email - used for account-level notifications (billing, daily reports) that aren't tied to a specific actor. */
export async function findOrgOwnerEmail(db: Database, organizationId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")))
    .limit(1);
  return row?.email ?? null;
}
