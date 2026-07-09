import { auth } from "../lib/auth.js";

export interface SignedUpUser {
  userId: string;
  email: string;
  password: string;
  headers: Headers;
}

function cookieHeadersFrom(setCookies: string[]): Headers {
  return new Headers({ cookie: setCookies.map((c) => c.split(";")[0]).join("; ") });
}

/** Signs up a fresh user and returns headers carrying their session cookie. */
export async function signUpUser(overrides: {
  email?: string;
  password?: string;
  name?: string;
} = {}): Promise<SignedUpUser> {
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2)}@example.com`;
  const password = overrides.password ?? "a-strong-password-123";
  const name = overrides.name ?? "Test User";

  const result = await auth.api.signUpEmail({
    body: { email, password, name },
    asResponse: true,
  });
  const headers = cookieHeadersFrom(result.headers.getSetCookie());
  const payload = (await result.json()) as { user: { id: string } };
  return { userId: payload.user.id, email, password, headers };
}

/** Creates an organization as the given user (owner role) and sets it active. */
export async function createOrgAsUser(
  headers: Headers,
  overrides: { name?: string; slug?: string } = {},
): Promise<{ id: string; slug: string }> {
  const name = overrides.name ?? "Test Org";
  const slug = overrides.slug ?? `test-org-${Math.random().toString(36).slice(2, 8)}`;
  const org = await auth.api.createOrganization({ headers, body: { name, slug } });
  if (!org) {
    throw new Error("createOrganization returned null");
  }
  return { id: org.id, slug: org.slug };
}

/** Full signup -> create-org -> active-org-set flow for a brand-new owner. */
export async function signUpOwnerWithOrg(
  overrides: { email?: string; password?: string; name?: string; orgName?: string; orgSlug?: string } = {},
): Promise<{ userId: string; email: string; headers: Headers; orgId: string; slug: string }> {
  const user = await signUpUser(overrides);
  const org = await createOrgAsUser(user.headers, { name: overrides.orgName, slug: overrides.orgSlug });
  return { ...user, orgId: org.id, slug: org.slug };
}

/** Signs up a second user and adds them to an existing org with the given role. */
export async function addUserToOrgWithRole(
  orgId: string,
  role: "owner" | "admin" | "editor" | "viewer",
  overrides: { email?: string; password?: string; name?: string } = {},
): Promise<SignedUpUser & { activeHeaders: Headers }> {
  const user = await signUpUser(overrides);
  await auth.api.addMember({ body: { userId: user.userId, organizationId: orgId, role } });
  await auth.api.setActiveOrganization({ headers: user.headers, body: { organizationId: orgId } });
  return { ...user, activeHeaders: user.headers };
}
