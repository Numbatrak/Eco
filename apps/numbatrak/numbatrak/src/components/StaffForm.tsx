import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "./layout/PageLayout";
import { SuccessNotification } from "./agents/SuccessNotification";
import { Button } from "./ui/button";
import { StaffDialog, StaffFormValues } from "./staff/StaffDialog";
import { usePermissions } from "../hooks/usePermissions";
import { useOrganization } from "../contexts/OrganizationContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useCachedStaff } from "../hooks/useCachedStaff";
import { createStaff, fetchEligibleMembers, setStaffActive, updateStaff } from "../services/staff";
import type { EligibleMember, Staff } from "../types/staff";
import type { SpecRole } from "../utils/specRoles";

const EMPTY_VALUES: StaffFormValues = {
  user_id: "",
  primary_role: "CRS",
  extra_roles: [],
  sub_brands: [],
  phone: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
};

function staffToValues(staff: Staff): StaffFormValues {
  return {
    user_id: staff.user_id,
    primary_role: staff.primary_role,
    extra_roles: staff.extra_roles,
    sub_brands: staff.sub_brands,
    phone: staff.phone ?? "",
    bank_name: staff.bank_name ?? "",
    bank_account_number: staff.bank_account_number ?? "",
    bank_account_name: staff.bank_account_name ?? "",
  };
}

export default function StaffForm() {
  const { hasPermission } = usePermissions();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const canCreate = hasPermission("staff", "canCreate");
  const canUpdate = hasPermission("staff", "canUpdate");

  const { data: staff, loading, error, updateItem } = useCachedStaff(currentOrganization?.id || null);

  const [eligibleMembers, setEligibleMembers] = useState<EligibleMember[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [values, setValues] = useState<StaffFormValues>(EMPTY_VALUES);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<SpecRole | "all">("all");

  useEffect(() => {
    if (canCreate) {
      fetchEligibleMembers().then(setEligibleMembers).catch(() => setEligibleMembers([]));
    }
  }, [canCreate, open]);

  const handleStartCreate = () => {
    setDialogMode("create");
    setEditingStaffId(null);
    setValues(EMPTY_VALUES);
    setDialogError(null);
    setOpen(true);
  };

  const handleStartEdit = (record: Staff) => {
    setDialogMode("edit");
    setEditingStaffId(record.id);
    setValues(staffToValues(record));
    setDialogError(null);
    setOpen(true);
  };

  const handleSubmit = async (formValues: StaffFormValues) => {
    setSaving(true);
    setDialogError(null);
    try {
      if (dialogMode === "edit" && editingStaffId) {
        const updated = await updateStaff(editingStaffId, {
          primary_role: formValues.primary_role,
          extra_roles: formValues.extra_roles,
          sub_brands: formValues.sub_brands,
          phone: formValues.phone || null,
          bank_name: formValues.bank_name || null,
          bank_account_number: formValues.bank_account_number || null,
          bank_account_name: formValues.bank_account_name || null,
        });
        updateItem(updated);
        setSuccess("Staff record updated.");
      } else {
        const created = await createStaff({
          user_id: formValues.user_id,
          primary_role: formValues.primary_role,
          extra_roles: formValues.extra_roles,
          sub_brands: formValues.sub_brands,
          phone: formValues.phone || null,
          bank_name: formValues.bank_name || null,
          bank_account_number: formValues.bank_account_number || null,
          bank_account_name: formValues.bank_account_name || null,
        });
        updateItem(created);
        setSuccess("Staff member added.");
      }
      setOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Failed to save staff record.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (record: Staff, active: boolean) => {
    const action = active ? "Reactivate" : "Deactivate";
    if (
      !(await confirm({
        title: `${action} staff member?`,
        description: active
          ? `"${record.user_name}" will show as active staff again.`
          : `"${record.user_name}" will be marked inactive. Their record and history are preserved - this does not remove their org login.`,
        confirmLabel: action,
        destructive: !active,
      }))
    ) {
      return;
    }
    try {
      const updated = await setStaffActive(record.id, active);
      updateItem(updated);
      setSuccess(active ? "Staff member reactivated." : "Staff member deactivated.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error updating staff status:", err);
    }
  };

  const filteredStaff = staff.filter((s) => roleFilter === "all" || s.primary_role === roleFilter || s.extra_roles.includes(roleFilter));

  return (
    <>
      <StaffDialog
        open={open}
        onOpenChange={setOpen}
        mode={dialogMode}
        eligibleMembers={eligibleMembers}
        values={values}
        onChange={setValues}
        error={dialogError}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <PageLayout>
        {success && <SuccessNotification message={success} onClose={() => setSuccess(null)} />}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">Staff</h1>
            <p className="text-muted-foreground text-sm">
              Internal team roster — roles, sub-brands, and bank details
            </p>
          </div>
          {canCreate && <Button onClick={handleStartCreate}>Add staff</Button>}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-2">
          <label htmlFor="staff-role-filter" className="text-sm text-muted-foreground">
            Filter by role
          </label>
          <select
            id="staff-role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as SpecRole | "all")}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="all">All roles</option>
            {(["CRS", "Manager", "Admin", "Media", "Accountant", "Founder"] as SpecRole[]).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : filteredStaff.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff records yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Primary role</th>
                  <th className="px-4 py-2">Extra roles</th>
                  <th className="px-4 py-2">Sub-brands</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((record) => (
                  <tr key={record.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link to={`/staff/${record.id}`} className="font-medium text-foreground hover:underline">
                        {record.user_name ?? record.user_email ?? record.user_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{record.primary_role}</td>
                    <td className="px-4 py-2">{record.extra_roles.join(", ") || "—"}</td>
                    <td className="px-4 py-2">{record.sub_brands.join(", ") || "—"}</td>
                    <td className="px-4 py-2">{record.active ? "Active" : "Inactive"}</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      {canUpdate && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleStartEdit(record)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetActive(record, !record.active)}
                          >
                            {record.active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageLayout>
    </>
  );
}
