import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useCachedStaff } from "../../hooks/useCachedStaff";
import { PageLayout } from "../layout/PageLayout";

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { currentOrganization } = useOrganization();
  const { data: staff, loading } = useCachedStaff(currentOrganization?.id || null);

  const record = staff.find((s) => s.id === staffId) ?? null;

  return (
    <PageLayout>
      <Link to="/staff" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to staff
      </Link>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !record ? (
        <p className="text-sm text-muted-foreground">Staff record not found.</p>
      ) : (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">{record.user_name ?? record.user_email}</h1>
            <p className="text-sm text-muted-foreground">{record.user_email}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 text-sm">
            <div>
              <div className="text-muted-foreground">Primary role</div>
              <div className="font-medium">{record.primary_role}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Extra roles</div>
              <div className="font-medium">{record.extra_roles.join(", ") || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Sub-brands</div>
              <div className="font-medium">{record.sub_brands.join(", ") || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Status</div>
              <div className="font-medium">{record.active ? "Active" : "Inactive"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Phone</div>
              <div className="font-medium">{record.phone ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Org role (login)</div>
              <div className="font-medium">{record.member_role ?? "—"}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 text-sm">
            <h2 className="mb-2 font-semibold text-foreground">Bank details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-muted-foreground">Bank</div>
                <div className="font-medium">{record.bank_name ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Account number</div>
                <div className="font-medium">{record.bank_account_number ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Account name</div>
                <div className="font-medium">{record.bank_account_name ?? "—"}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
