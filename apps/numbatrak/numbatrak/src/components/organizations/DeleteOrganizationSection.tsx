import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { authApi } from "../../lib/authApi";
import { useOrganization } from "../../contexts/OrganizationContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface DeleteOrganizationSectionProps {
  organizationId: string;
  organizationName: string;
}

/**
 * Owner-only, irreversible organization deletion. Uses Better Auth's
 * built-in `/organization/delete` endpoint (see lib/authApi.ts's
 * deleteOrganization) - already gated server-side to Owner via
 * apps/api/src/lib/access-control.ts's `organization: ["delete"]` grant.
 * Every numbatrak table's organizationId column cascades on delete
 * (packages/db/src/schema/numbatrak/*.ts), so the DB cleans itself up with
 * no bespoke per-table deletion code here.
 *
 * A typed exact-name match gates the button - stronger than the standard
 * confirm() dialog used elsewhere on this page (ConfirmContext), because
 * deleting an org destroys strictly more than a single member/invitation.
 */
export function DeleteOrganizationSection({ organizationId, organizationName }: DeleteOrganizationSectionProps) {
  const navigate = useNavigate();
  const { refreshOrganizations } = useOrganization();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText.trim() === organizationName && !deleting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await authApi.deleteOrganization(organizationId);
      await refreshOrganizations();
      // Mirrors OrganizationSelectionPage.tsx's post-leave/post-create
      // navigation - if the user has no organizations left, App.tsx's
      // needsOrganizationSelection guard takes over from here and routes to
      // /select-organization; otherwise they land in whichever org is next.
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Error deleting organization:", err);
      setError(err instanceof Error ? err.message : "Failed to delete organization");
      setDeleting(false);
    }
  };

  return (
    <div className="org-settings-section border border-destructive/40 bg-destructive/5 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h2 className="org-settings-section-title mb-0 text-destructive">Danger zone</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Deleting <span className="font-semibold text-foreground">{organizationName}</span> permanently
        removes the organization and every record tied to it - products, orders, staff, payroll,
        remittance, everything. This cannot be undone.
      </p>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      <label className="flex flex-col gap-1 text-sm max-w-md mb-4">
        <span className="text-muted-foreground">
          Type <span className="font-semibold text-foreground">{organizationName}</span> to confirm
        </span>
        <Input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={organizationName}
          autoComplete="off"
        />
      </label>

      <Button type="button" variant="destructive" disabled={!canDelete} onClick={handleDelete} className="gap-2">
        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        {deleting ? "Deleting…" : "Delete organization"}
      </Button>
    </div>
  );
}
