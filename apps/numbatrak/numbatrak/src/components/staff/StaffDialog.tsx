import { FormEvent, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { EligibleMember, EmploymentStatus, Staff } from "../../types/staff";
import { SpecRole, SPEC_TO_APP_ROLES } from "../../utils/specRoles";
import { mapOrgRoleToUserRole } from "../../utils/roleMapping";
import type { OrgRole } from "../../lib/authApi";

const ALL_SPEC_ROLES: SpecRole[] = ["CRS", "Manager", "Admin", "Media", "Accountant", "Founder"];

export interface StaffFormValues {
  user_id: string;
  primary_role: SpecRole;
  extra_roles: SpecRole[];
  sub_brands: string[];
  phone: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  manager_id: string | null;
  employment_status: EmploymentStatus;
  deactivation_reason: string;
  on_probation: boolean;
  probation_ends_at: string;
}

interface StaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  eligibleMembers: EligibleMember[];
  /** Existing staff records, for the manager picker. Caller excludes the record being edited. */
  staffOptions: Staff[];
  values: StaffFormValues;
  onChange: (values: StaffFormValues) => void;
  error: string | null;
  saving: boolean;
  onSubmit: (values: StaffFormValues) => void;
}

/** Which spec roles a given real member.role can hold as primaryRole. */
function compatibleSpecRoles(memberRole: string): SpecRole[] {
  const userRole = mapOrgRoleToUserRole(memberRole as OrgRole);
  return ALL_SPEC_ROLES.filter((role) => SPEC_TO_APP_ROLES[role].includes(userRole));
}

export function StaffDialog({
  open,
  onOpenChange,
  mode,
  eligibleMembers,
  staffOptions,
  values,
  onChange,
  error,
  saving,
  onSubmit,
}: StaffDialogProps) {
  const [subBrandInput, setSubBrandInput] = useState("");

  const selectedMember = useMemo(
    () => eligibleMembers.find((m) => m.user_id === values.user_id) ?? null,
    [eligibleMembers, values.user_id]
  );

  const roleOptions = selectedMember ? compatibleSpecRoles(selectedMember.member_role) : ALL_SPEC_ROLES;

  const checkedRoles = [values.primary_role, ...values.extra_roles];

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(values);
  };

  // Single flat role list - whichever checked role appears earliest in
  // roleOptions order becomes primary_role, the rest are extra_roles. Avoids
  // showing the same role names in two separate lists (a dropdown + a
  // checkbox group) for what's really one "which roles does this person
  // hold" decision.
  const toggleRole = (role: SpecRole) => {
    const isChecked = checkedRoles.includes(role);
    const nextChecked = isChecked
      ? checkedRoles.filter((r) => r !== role)
      : [...checkedRoles, role];
    if (nextChecked.length === 0) return; // must keep at least one role
    const ordered = roleOptions.filter((r) => nextChecked.includes(r));
    const [primary, ...extra] = ordered;
    onChange({ ...values, primary_role: primary, extra_roles: extra });
  };

  const addSubBrand = () => {
    const trimmed = subBrandInput.trim();
    if (trimmed && !values.sub_brands.includes(trimmed)) {
      onChange({ ...values, sub_brands: [...values.sub_brands, trimmed] });
    }
    setSubBrandInput("");
  };

  const removeSubBrand = (brand: string) => {
    onChange({ ...values, sub_brands: values.sub_brands.filter((b) => b !== brand) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add staff member" : "Edit staff member"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "create" && (
            <div className="space-y-2">
              <Label>Team member</Label>
              <Select
                value={values.user_id}
                onValueChange={(userId) =>
                  onChange({ ...values, user_id: userId, primary_role: "CRS", extra_roles: [] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an org member" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleMembers
                    .filter((m) => !m.has_staff_record)
                    .map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.name} ({m.email}) — {m.member_role}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-3">
              {roleOptions.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checkedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                    disabled={mode === "create" && !values.user_id}
                  />
                  {role}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Check every role this person performs — access is the combined
              (union) of all checked roles. Managers only see their own
              team&apos;s orders/dashboard data; set that scope with the
              Manager field below.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Sub-brands covered</Label>
            <div className="flex gap-2">
              <Input
                value={subBrandInput}
                onChange={(e) => setSubBrandInput(e.target.value)}
                placeholder="Add a sub-brand"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubBrand();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addSubBrand}>
                Add
              </Button>
            </div>
            {values.sub_brands.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {values.sub_brands.map((brand) => (
                  <span
                    key={brand}
                    className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
                  >
                    {brand}
                    <button
                      type="button"
                      onClick={() => removeSubBrand(brand)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Manager</Label>
            <Select
              value={values.manager_id ?? "none"}
              onValueChange={(v) => onChange({ ...values, manager_id: v === "none" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.user_name ?? s.user_email ?? s.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Drives &quot;managers see their team&quot; scoping for Staff.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={values.phone}
                onChange={(e) => onChange({ ...values, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Bank name</Label>
              <Input
                value={values.bank_name}
                onChange={(e) => onChange({ ...values, bank_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Account number</Label>
              <Input
                value={values.bank_account_number}
                onChange={(e) => onChange({ ...values, bank_account_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Account name</Label>
              <Input
                value={values.bank_account_name}
                onChange={(e) => onChange({ ...values, bank_account_name: e.target.value })}
              />
            </div>
          </div>

          {mode === "edit" && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-2">
                <Label>Employment status</Label>
                <Select
                  value={values.employment_status}
                  onValueChange={(v) => onChange({ ...values, employment_status: v as EmploymentStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On leave</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(values.employment_status === "inactive" || values.employment_status === "suspended") && (
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea
                    value={values.deactivation_reason}
                    onChange={(e) => onChange({ ...values, deactivation_reason: e.target.value })}
                    rows={2}
                    placeholder="Why is this person being marked inactive/suspended?"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.on_probation}
                  onCheckedChange={(checked) => onChange({ ...values, on_probation: checked === true })}
                />
                On probation
              </label>

              {values.on_probation && (
                <div className="space-y-2">
                  <Label>Probation ends</Label>
                  <Input
                    type="date"
                    value={values.probation_ends_at}
                    onChange={(e) => onChange({ ...values, probation_ends_at: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || (mode === "create" && !values.user_id)}>
              {saving ? "Saving..." : mode === "create" ? "Add staff" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
