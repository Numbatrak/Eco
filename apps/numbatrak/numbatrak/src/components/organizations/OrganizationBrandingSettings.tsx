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

interface OrganizationBrandingSettingsProps {
  organization: OrganizationWithRole;
  canEdit: boolean;
  onUpdated: (org: OrganizationWithRole) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function OrganizationBrandingSettings({
  organization,
  canEdit,
  onUpdated,
  onError,
  onSuccess,
}: OrganizationBrandingSettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [timezone, setTimezone] = useState(
    organization.timezone ?? DEFAULT_TIMEZONE
  );
  const [currency, setCurrency] = useState(
    organization.currency ?? DEFAULT_CURRENCY
  );
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setTimezone(organization.timezone ?? DEFAULT_TIMEZONE);
    setCurrency(organization.currency ?? DEFAULT_CURRENCY);
  }, [organization]);

  const handleSaveLocale = async () => {
    if (!canEdit) return;
    try {
      setSaving(true);
      const updated = await updateOrganization(organization.id, {
        timezone,
        currency,
      });
      onUpdated({ ...organization, ...updated });
      onSuccess("Business locale settings saved.");
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to save locale settings.");
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

  const localeDirty =
    timezone !== (organization.timezone ?? DEFAULT_TIMEZONE) ||
    currency !== (organization.currency ?? DEFAULT_CURRENCY);

  return (
    <div className="org-settings-section">
      <h2 className="org-settings-section-title">Business branding</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Logo, timezone, and currency for this organization
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
            onClick={handleSaveLocale}
            disabled={saving || !localeDirty}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save locale settings
          </button>
        )}
      </div>
    </div>
  );
}
