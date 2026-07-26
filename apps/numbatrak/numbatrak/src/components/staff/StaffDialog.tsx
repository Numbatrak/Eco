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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { EligibleMember } from "../../types/staff";
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
}

interface StaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  eligibleMembers: EligibleMember[];
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(values);
  };

  const toggleExtraRole = (role: SpecRole) => {
    const has = values.extra_roles.includes(role);
    onChange({
      ...values,
      extra_roles: has ? values.extra_roles.filter((r) => r !== role) : [...values.extra_roles, role],
    });
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
            <Label>Primary role</Label>
            <Select
              value={values.primary_role}
              onValueChange={(role) => onChange({ ...values, primary_role: role as SpecRole })}
              disabled={mode === "create" && !values.user_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Extra roles</Label>
            <div className="flex flex-wrap gap-3">
              {ALL_SPEC_ROLES.filter((role) => role !== values.primary_role).map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={values.extra_roles.includes(role)}
                    onCheckedChange={() => toggleExtraRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
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
