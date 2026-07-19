"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { TenantSettingsResponse } from "@platform/shared-types";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { TextField } from "../../../components/dashboard/TextField";
import { useAuth } from "../../../components/dashboard/AuthContext";
import { commerceApi } from "../../../lib/commerceApi";
import { ApiError } from "../../../lib/apiClient";

const subdomainFormSchema = z.object({
  subdomain: z.string().trim().min(3, "At least 3 characters").max(63),
});
type SubdomainFormValues = z.infer<typeof subdomainFormSchema>;

function SiteSettingsInner(): React.ReactElement {
  const { refreshMe } = useAuth();
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

  const load = useCallback(async (): Promise<void> => {
    try {
      const data = await commerceApi.getTenantSettings();
      setSettings(data);
      reset({ subdomain: data.subdomain ?? "" });
    } catch {
      setLoadError("Could not load site settings.");
    }
  }, [reset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmitSubdomain(values: SubdomainFormValues): Promise<void> {
    setSubdomainError(null);
    setSavedNotice(null);
    try {
      await commerceApi.updateTenantSettings({ subdomain: values.subdomain });
      await load();
      await refreshMe();
      setSavedNotice("Subdomain updated.");
    } catch (error) {
      setSubdomainError(
        error instanceof ApiError ? error.message : "Could not update subdomain.",
      );
    }
  }

  async function handleTogglePublished(): Promise<void> {
    if (!settings) return;
    setToggleError(null);
    try {
      await commerceApi.updateTenantSettings({ published: !settings.published });
      await load();
    } catch (error) {
      setToggleError(
        error instanceof ApiError ? error.message : "Could not update publish status.",
      );
    }
  }

  async function handleToggleProductGrid(): Promise<void> {
    if (!settings) return;
    setToggleError(null);
    try {
      await commerceApi.updateTenantSettings({ showProductGrid: !settings.showProductGrid });
      await load();
    } catch (error) {
      setToggleError(
        error instanceof ApiError ? error.message : "Could not update the product grid setting.",
      );
    }
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
    <div
      style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
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
        style={{
          padding: "var(--space-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 14,
          }}
        >
          <span>Publish your storefront</span>
          <input
            type="checkbox"
            checked={settings.published}
            onChange={() => void handleTogglePublished()}
          />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 14,
          }}
        >
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

export default function SiteSettingsPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <SiteSettingsInner />
      </DashboardLayout>
    </RequireAuth>
  );
}
