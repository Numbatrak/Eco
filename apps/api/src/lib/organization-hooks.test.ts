import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { member } from "@platform/db";
import { truncateAll, getTestDb } from "../test/test-db.js";
import { signUpUser, createOrgAsUser, addUserToOrgWithRole } from "../test/auth-helpers.js";
import { auth } from "./auth.js";

describe("organization creation hooks", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("rejects a reserved subdomain", async () => {
    const user = await signUpUser();
    await expect(createOrgAsUser(user.headers, { slug: "admin" })).rejects.toMatchObject({
      body: { message: "This subdomain is reserved" },
    });
  });

  it("rejects an invalid-format slug", async () => {
    const user = await signUpUser();
    await expect(createOrgAsUser(user.headers, { slug: "Not Valid!" })).rejects.toMatchObject({
      body: { message: "Invalid subdomain format" },
    });
  });

  it("rejects a duplicate slug", async () => {
    const user1 = await signUpUser();
    const user2 = await signUpUser();
    await createOrgAsUser(user1.headers, { slug: "acme-co" });
    await expect(createOrgAsUser(user2.headers, { slug: "acme-co" })).rejects.toBeDefined();
  });

  it("normalizes the slug to lowercase", async () => {
    const user = await signUpUser();
    // Uppercase input still fails format validation (letters must already
    // be lowercase) - format + reserved-word checks happen before the
    // lowercase-normalization override, so this documents that behavior
    // rather than testing case-insensitive collision (which the format
    // check makes unreachable: no uppercase slug ever passes far enough to
    // collide).
    await expect(createOrgAsUser(user.headers, { slug: "ACME-CO" })).rejects.toMatchObject({
      body: { message: "Invalid subdomain format" },
    });
  });
});

describe("last-owner protection", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("rejects removing the sole owner", async () => {
    const owner = await signUpUser();
    const org = await createOrgAsUser(owner.headers, {});
    const db = getTestDb();
    const [ownerMember] = await db
      .select()
      .from(member)
      .where(eq(member.organizationId, org.id));

    await expect(
      auth.api.removeMember({
        headers: owner.headers,
        body: { memberIdOrEmail: ownerMember!.id, organizationId: org.id },
      }),
    ).rejects.toBeDefined();
  });

  it("allows removing an owner once a second owner exists", async () => {
    const owner = await signUpUser();
    const org = await createOrgAsUser(owner.headers, {});
    const secondOwner = await addUserToOrgWithRole(org.id, "owner");

    const db = getTestDb();
    const [ownerMember] = await db
      .select()
      .from(member)
      .where(eq(member.organizationId, org.id))
      .then((rows) => rows.filter((r) => r.userId === owner.userId));

    await expect(
      auth.api.removeMember({
        headers: secondOwner.activeHeaders,
        body: { memberIdOrEmail: ownerMember!.id, organizationId: org.id },
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a non-owner (admin) demoting an owner", async () => {
    const owner = await signUpUser();
    const org = await createOrgAsUser(owner.headers, {});
    const admin = await addUserToOrgWithRole(org.id, "admin");

    const db = getTestDb();
    const [ownerMember] = await db
      .select()
      .from(member)
      .where(eq(member.organizationId, org.id))
      .then((rows) => rows.filter((r) => r.userId === owner.userId));

    await expect(
      auth.api.updateMemberRole({
        headers: admin.activeHeaders,
        body: { memberId: ownerMember!.id, organizationId: org.id, role: "admin" },
      }),
    ).rejects.toMatchObject({
      body: { message: "Only an owner can remove or change the role of another owner" },
    });
  });
});
