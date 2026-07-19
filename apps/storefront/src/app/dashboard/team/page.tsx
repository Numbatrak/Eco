"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { useAuth } from "../../../components/dashboard/AuthContext";
import { authApi, type OrgMember, type OrgInvitation } from "../../../lib/authApi";
import { ApiError } from "../../../lib/apiClient";

const AVAILABLE_ROLES = ["admin", "editor", "viewer"] as const;

function InviteForm({ organizationId, onInvited }: { organizationId: string; onInvited: () => void }): React.ReactElement {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await authApi.inviteMember(email.trim(), role, organizationId);
      setEmail("");
      setRole("viewer");
      onInvited();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send invite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
      <div className="field" style={{ flex: 1, minWidth: 200 }}>
        <label htmlFor="invite-email" className="field-label">Email</label>
        <input id="invite-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="colleague@example.com" />
      </div>
      <div className="field" style={{ minWidth: 120 }}>
        <label htmlFor="invite-role" className="field-label">Role</label>
        <select id="invite-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          {AVAILABLE_ROLES.map((r) => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "Sending…" : "Invite"}
      </button>
      {error && <div className="form-error" style={{ width: "100%" }}>{error}</div>}
    </form>
  );
}

function MembersTable({ members, currentUserId, organizationId, onChanged }: {
  members: OrgMember[];
  currentUserId: string;
  organizationId: string;
  onChanged: () => void;
}): React.ReactElement {
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRemove(member: OrgMember): Promise<void> {
    if (!confirm(`Remove ${member.user.name} from this organization?`)) return;
    setActionError(null);
    try {
      await authApi.removeMember(member.user.email, organizationId);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to remove member.");
    }
  }

  async function handleRoleChange(member: OrgMember, newRole: string): Promise<void> {
    setActionError(null);
    try {
      await authApi.updateMemberRole(member.id, newRole, organizationId);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update role.");
    }
  }

  return (
    <div>
      {actionError && <div className="form-error" style={{ marginBottom: "var(--space-3)" }}>{actionError}</div>}
      <table className="data-table" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.user.name}</td>
              <td>{m.user.email}</td>
              <td>
                {m.userId === currentUserId ? (
                  <span>{m.role}</span>
                ) : (
                  <select
                    className="input"
                    value={m.role}
                    onChange={(e) => void handleRoleChange(m, e.target.value)}
                    style={{ padding: "4px 6px", fontSize: "13px" }}
                  >
                    {["owner", ...AVAILABLE_ROLES].map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                )}
              </td>
              <td>
                {m.userId !== currentUserId && (
                  <button type="button" className="btn btn-secondary" style={{ fontSize: "13px", padding: "4px 10px" }} onClick={() => void handleRemove(m)}>
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvitationsTable({ invitations, onChanged }: {
  invitations: OrgInvitation[];
  onChanged: () => void;
}): React.ReactElement {
  const [actionError, setActionError] = useState<string | null>(null);
  const pending = invitations.filter((i) => i.status === "pending");

  if (pending.length === 0) return <p className="field-hint">No pending invitations.</p>;

  async function handleCancel(id: string): Promise<void> {
    setActionError(null);
    try {
      await authApi.cancelInvitation(id);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel invitation.");
    }
  }

  return (
    <div>
      {actionError && <div className="form-error" style={{ marginBottom: "var(--space-3)" }}>{actionError}</div>}
      <table className="data-table" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Expires</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pending.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.email}</td>
              <td>{inv.role ?? "viewer"}</td>
              <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
              <td>
                <button type="button" className="btn btn-secondary" style={{ fontSize: "13px", padding: "4px 10px" }} onClick={() => void handleCancel(inv.id)}>
                  Cancel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamPageInner(): React.ReactElement {
  const { user, activeOrganization } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!activeOrganization) return;
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        authApi.listMembers(activeOrganization.id),
        authApi.listInvitations(),
      ]);
      setMembers(membersRes.members ?? []);
      setInvitations(invitationsRes.invitations ?? []);
    } catch {
      // API may not be available
    } finally {
      setLoading(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!activeOrganization || !user) return <p>No organization selected.</p>;

  const hasRole = (role: string) =>
    activeOrganization.role.split(",").map((r) => r.trim()).includes(role);
  const canManageMembers = hasRole("owner") || hasRole("admin");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div>
        <h1>Team</h1>
        <p className="field-hint">Manage members and invitations for {activeOrganization.name}.</p>
      </div>

      {canManageMembers && (
        <div className="panel" style={{ padding: "var(--space-4)" }}>
          <h2 style={{ marginBottom: "var(--space-3)" }}>Invite a team member</h2>
          <InviteForm organizationId={activeOrganization.id} onInvited={() => void refresh()} />
        </div>
      )}

      <div className="panel" style={{ padding: "var(--space-4)" }}>
        <h2 style={{ marginBottom: "var(--space-3)" }}>Members</h2>
        {loading ? <p className="field-hint">Loading…</p> : (
          <MembersTable members={members} currentUserId={user.id} organizationId={activeOrganization.id} onChanged={() => void refresh()} />
        )}
      </div>

      {canManageMembers && (
        <div className="panel" style={{ padding: "var(--space-4)" }}>
          <h2 style={{ marginBottom: "var(--space-3)" }}>Pending invitations</h2>
          {loading ? <p className="field-hint">Loading…</p> : (
            <InvitationsTable invitations={invitations} onChanged={() => void refresh()} />
          )}
        </div>
      )}
    </div>
  );
}

export default function TeamPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <TeamPageInner />
      </DashboardLayout>
    </RequireAuth>
  );
}
