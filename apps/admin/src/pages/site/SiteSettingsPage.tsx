import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { TenantSettingsResponse } from "@platform/shared-types";
import { useAuth } from "../../context/AuthContext";
import { commerceApi } from "../../lib/commerceApi";
import { TextField } from "../../components/TextField";
import { ApiError } from "../../lib/apiClient";

const subdomainFormSchema = z.object({
  subdomain: z.string().trim().min(3, "At least 3 characters").max(63),
});
type SubdomainFormValues = z.infer<typeof subdomainFormSchema>;

export default function SiteSettingsPage(): React.ReactElement {
  const { accessToken, currentTenant, refreshCurrentTenant } = useAuth();
  const [settings, setSettings] = useState<TenantSettingsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubdomainFormValues>({
    resolver: zodResolver(subdomainFormSchema),
    defaultValues: { subdomain: "" },
  });

  async function load(): Promise<void> {
    if (!accessToken || !currentTenant) {
      return;
    }
    try {
      const data = await commerceApi.getTenantSettings(accessToken, currentTenant.id);
      setSettings(data);
      reset({ subdomain: data.subdomain ?? "" });
    } catch {
      setLoadError("Could not load site settings.");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken, currentTenant]);

  async function onSubmitSubdomain(values: SubdomainFormValues): Promise<void> {
    if (!accessToken || !currentTenant) {
      return;
    }
    setSubdomainError(null);
    setSavedNotice(null);
    try {
      await commerceApi.updateTenantSettings(accessToken, currentTenant.id, {
        subdomain: values.subdomain,
      });
      await load();
      await refreshCurrentTenant();
      setSavedNotice("Subdomain updated.");
    } catch (error) {
      setSubdomainError(error instanceof ApiError ? error.message : "Could not update subdomain.");
    }
  }

  async function handleTogglePublished(): Promise<void> {
    if (!accessToken || !currentTenant || !settings) {
      return;
    }
    setToggleError(null);
    try {
      await commerceApi.updateTenantSettings(accessToken, currentTenant.id, {
        published: !settings.published,
      });
      await load();
    } catch (error) {
      setToggleError(error instanceof ApiError ? error.message : "Could not update publish status.");
    }
  }

  async function handleToggleProductGrid(): Promise<void> {
    if (!accessToken || !currentTenant || !settings) {
      return;
    }
    setToggleError(null);
    try {
      await commerceApi.updateTenantSettings(accessToken, currentTenant.id, {
        showProductGrid: !settings.showProductGrid,
      });
      await load();
    } catch (error) {
      setToggleError(
        error instanceof ApiError ? error.message : "Could not update the product grid setting.",
      );
    }
  }

  if (!currentTenant) {
    return <p className="field-hint">Loading your store…</p>;
  }
  if (loadError) {
    return (
      <div className="banner banner-danger" role="alert">
        {loadError}
      </div>
    );
  }
  if (!settings) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <h1>Site settings</h1>

      <form
        onSubmit={handleSubmit(onSubmitSubdomain)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
      >
        <TextField
          label="Subdomain"
          hint={!errors.subdomain ? "yourshop.example.com" : undefined}
          error={errors.subdomain?.message}
          {...register("subdomain")}
        />
        {subdomainError ? (
          <div className="banner banner-danger" role="alert">
            {subdomainError}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save subdomain"}
        </button>
      </form>

      {savedNotice ? (
        <div className="banner banner-success" role="status">
          {savedNotice}
        </div>
      ) : null}

      <div
        className="panel"
        style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
      >
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 }}>
          <span>Publish your storefront</span>
          <input type="checkbox" checked={settings.published} onChange={() => void handleTogglePublished()} />
        </label>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 }}>
          <span>Show a live product grid on your storefront</span>
          <input
            type="checkbox"
            checked={settings.showProductGrid}
            onChange={() => void handleToggleProductGrid()}
          />
        </label>
        {toggleError ? (
          <div className="banner banner-danger" role="alert">
            {toggleError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
