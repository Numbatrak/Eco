import { sql, eq } from "drizzle-orm";
import { users, type Database } from "@platform/db";

export type UserRow = typeof users.$inferSelect;

export async function findUserByEmail(db: Database, email: string): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return row ?? null;
}

export async function findUserById(db: Database, id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export interface CreateUserParams {
  email: string;
  passwordHash: string;
}

export async function createUser(
  db: Database,
  params: CreateUserParams,
): Promise<{ id: string; email: string }> {
  const [created] = await db
    .insert(users)
    .values({ email: params.email, passwordHash: params.passwordHash })
    .returning({ id: users.id, email: users.email });
  if (!created) {
    throw new Error("Failed to create user");
  }
  return created;
}

export interface UserPatch {
  passwordHash?: string;
  totpSecretEncrypted?: string | null;
  totpEnabledAt?: Date | null;
  emailOtpEnabledAt?: Date | null;
  preferred2faMethod?: "totp" | "email_otp" | null;
}

export async function updateUser(db: Database, id: string, patch: UserPatch): Promise<void> {
  await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id));
}
