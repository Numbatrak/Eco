import { useEffect, useRef, useState } from "react";
import { Building2, Camera, Loader2, Save } from "lucide-react";
import {
  updateOrganization,
  uploadOrganizationLogo,
} from "../../services/organizations";
import { OrganizationWithRole } from "../../types/organization";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
} from "../../constants/profileOptions";

interface GeneralSettingsProps {
  organization: OrganizationWithRole;
  canEdit: boolean;
  onUpdated: (org: OrganizationWithRole) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

/**
 * The spec's "Profile" layer (business identity, timezone, currency) -
 * everything here is stored in Better Auth's `organization.metadata` JSON
 * (see services/organizations.ts's updateOrganization doc comment), which
 * the update endpoint replaces wholesale. One save button submits all four
 * metadata-backed fields together every time, so saving e.g. just a phone
 * number can never silently wipe the saved timezone/currency.
 */
export function GeneralSettings({
  organization,
  canEdit,
  onUpdated,
  onError,
  onSuccess,
}: GeneralSettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [timezone, setTimezone] = useState(
    organization.timezone ?? DEFAULT_TIMEZONE
  );
  const [currency, setCurrency] = useState(
    organization.currency ?? DEFAULT_CURRENCY
  );
  const [businessPhone, setBusinessPhone] = useState(
    organization.business_phone ?? ""
  );
  const [businessWhatsapp, setBusinessWhatsapp] = useState(
    organization.business_whatsapp ?? ""
  );
  const [businessAddress, setBusinessAddress] = useState(
    organization.business_address ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setTimezone(organization.timezone ?? DEFAULT_TIMEZONE);
    setCurrency(organization.currency ?? DEFAULT_CURRENCY);
    setBusinessPhone(organization.business_phone ?? "");
    setBusinessWhatsapp(organization.business_whatsapp ?? "");
    setBusinessAddress(organization.business_address ?? "");
  }, [organization]);

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      setSaving(true);
      const updated = await updateOrganization(organization.id, {
        timezone,
        currency,
        business_phone: businessPhone.trim() || null,
        business_whatsapp: businessWhatsapp.trim() || null,
        business_address: businessAddress.trim() || null,
      });
      onUpdated({ ...organization, ...updated });
      onSuccess("General settings saved.");
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to save general settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;

    try {
      setUploadingLogo(true);
      const logoUrl = await uploadOrganizationLogo(organization.id, file);
      onUpdated({ ...organization, logo_url: logoUrl });
      onSuccess("Business logo updated.");
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const dirty =
    timezone !== (organization.timezone ?? DEFAULT_TIMEZONE) ||
    currency !== (organization.currency ?? DEFAULT_CURRENCY) ||
    businessPhone !== (organization.business_phone ?? "") ||
    businessWhatsapp !== (organization.business_whatsapp ?? "") ||
    businessAddress !== (organization.business_address ?? "");

  return (
    <div className="org-settings-section">
      <h2 className="org-settings-section-title">General settings</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Business identity, contact details, timezone, and currency for this organization
      </p>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative shrink-0">
            {organization.logo_url ? (
              <img
                src={organization.logo_url}
                alt={`${organization.name} logo`}
                className="w-20 h-20 rounded-lg object-contain border border-border bg-background"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/40">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="absolute -bottom-1 -right-1 p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors disabled:opacity-60"
                  title="Upload business logo"
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Shown on reports and customer-facing materials. Recommended square
            image, max 5 MB.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="orgBusinessPhone" className="text-sm font-medium">
              Business phone
            </label>
            <input
              id="orgBusinessPhone"
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. +234 800 000 0000"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="orgBusinessWhatsapp" className="text-sm font-medium">
              Business WhatsApp number
            </label>
            <input
              id="orgBusinessWhatsapp"
              type="tel"
              value={businessWhatsapp}
              onChange={(e) => setBusinessWhatsapp(e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. +234 800 000 0000"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Used for customer-facing WhatsApp notifications.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="orgBusinessAddress" className="text-sm font-medium">
            Business address
          </label>
          <textarea
            id="orgBusinessAddress"
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            disabled={!canEdit}
            placeholder="e.g. 12 Example Street, Lagos, Nigeria"
            rows={2}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Shown on generated invoices alongside your logo.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="orgTimezone" className="text-sm font-medium">
              Business timezone
            </label>
            <select
              id="orgTimezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="orgCurrency" className="text-sm font-medium">
              Business currency
            </label>
            <select
              id="orgCurrency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save general settings
          </button>
        )}
      </div>
    </div>
  );
}
