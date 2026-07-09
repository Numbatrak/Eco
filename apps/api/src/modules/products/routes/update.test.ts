import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { truncateAll } from "../../../test/test-db.js";
import { signUpOwnerWithOrg, addUserToOrgWithRole } from "../../../test/auth-helpers.js";
import updateProductRoutes from "./update.js";
import createProductRoutes from "./create.js";

async function seedProduct(orgId: string, cookie: string, app: Awaited<ReturnType<typeof buildTestApp>>) {
  const response = await app.inject({
    method: "POST",
    url: "/org/products",
    headers: { cookie },
    payload: { name: "Widget", priceCents: 1000, currency: "USD" },
  });
  return response.json().id as string;
}

describe("PATCH /org/products/:productId", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("rejects a viewer-role caller (no products.edit permission)", async () => {
    const owner = await signUpOwnerWithOrg();
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [createProductRoutes, updateProductRoutes] });
    const productId = await seedProduct(owner.orgId, owner.headers.get("cookie") ?? "", app);

    const viewer = await addUserToOrgWithRole(owner.orgId, "viewer");
    const response = await app.inject({
      method: "PATCH",
      url: `/org/products/${productId}`,
      headers: { cookie: viewer.activeHeaders.get("cookie") ?? "" },
      payload: { name: "Renamed Widget" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("allows an editor to edit and an owner to edit", async () => {
    const owner = await signUpOwnerWithOrg();
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [createProductRoutes, updateProductRoutes] });
    const productId = await seedProduct(owner.orgId, owner.headers.get("cookie") ?? "", app);

    const editor = await addUserToOrgWithRole(owner.orgId, "editor");
    const editorResponse = await app.inject({
      method: "PATCH",
      url: `/org/products/${productId}`,
      headers: { cookie: editor.activeHeaders.get("cookie") ?? "" },
      payload: { name: "Edited by editor" },
    });
    expect(editorResponse.statusCode).toBe(200);

    const ownerResponse = await app.inject({
      method: "PATCH",
      url: `/org/products/${productId}`,
      headers: { cookie: owner.headers.get("cookie") ?? "" },
      payload: { name: "Edited by owner" },
    });
    expect(ownerResponse.statusCode).toBe(200);
  });
});

/**
 * Full permission-matrix assertion, straight against the access-control
 * roles rather than through HTTP - the editor/viewer distinction (closed
 * list vs "every *.view") is the easiest part of this matrix to get subtly
 * wrong (see ../../../lib/access-control.ts), so this pins the whole grid
 * down rather than relying only on the one products.edit HTTP case above.
 */
describe("role permission matrix", () => {
  afterEach(async () => {
    await truncateAll();
  });

  const cases: Array<{
    role: "owner" | "admin" | "editor" | "viewer";
    permissions: Record<string, string[]>;
    allowed: boolean;
  }> = [
    { role: "owner", permissions: { billing: ["manage"] }, allowed: true },
    { role: "owner", permissions: { site: ["publish"] }, allowed: true },
    { role: "owner", permissions: { members: ["manage_roles"] }, allowed: true },
    { role: "admin", permissions: { billing: ["manage"] }, allowed: false },
    { role: "admin", permissions: { billing: ["view"] }, allowed: true },
    { role: "admin", permissions: { site: ["edit"] }, allowed: true },
    { role: "admin", permissions: { members: ["invite"] }, allowed: true },
    { role: "editor", permissions: { site: ["edit"] }, allowed: true },
    { role: "editor", permissions: { products: ["edit"] }, allowed: true },
    { role: "editor", permissions: { products: ["view"] }, allowed: true },
    { role: "editor", permissions: { orders: ["view"] }, allowed: false },
    { role: "editor", permissions: { billing: ["view"] }, allowed: false },
    { role: "editor", permissions: { settings: ["manage"] }, allowed: false },
    { role: "viewer", permissions: { products: ["view"] }, allowed: true },
    { role: "viewer", permissions: { billing: ["view"] }, allowed: true },
    { role: "viewer", permissions: { orders: ["view"] }, allowed: true },
    { role: "viewer", permissions: { products: ["edit"] }, allowed: false },
    { role: "viewer", permissions: { site: ["edit"] }, allowed: false },
    { role: "viewer", permissions: { settings: ["manage"] }, allowed: false },
  ];

  it.each(cases)("$role x $permissions -> allowed=$allowed", async ({ role, permissions, allowed }) => {
    const owner = await signUpOwnerWithOrg();
    const member =
      role === "owner" ? owner : await addUserToOrgWithRole(owner.orgId, role);
    const headers = "activeHeaders" in member ? member.activeHeaders : member.headers;

    const { auth } = await import("../../../lib/auth.js");
    const result = await auth.api.hasPermission({
      headers,
      body: { organizationId: owner.orgId, permissions },
    });

    expect(result.success).toBe(allowed);
  });
});
