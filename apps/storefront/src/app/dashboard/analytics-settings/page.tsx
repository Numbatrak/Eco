"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { AnalyticsSettingsResponse } from "@platform/shared-types";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { TextField } from "../../../components/dashboard/TextField";
import { PasswordField } from "../../../components/dashboard/PasswordField";
import { commerceApi } from "../../../lib/commerceApi";
import { ApiError } from "../../../lib/apiClient";

const formSchema = z.object({
  metaPixelId: z.string().trim().min(1, "Pixel ID is required"),
  metaCapiToken: z.string().trim().min(1, "CAPI access token is required"),
  enabled: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

function AnalyticsSettingsInner(): React.ReactElement {
  const [settings, setSettings] = useState<AnalyticsSettingsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { metaPixelId: "", metaCapiToken: "", enabled: false },
  });

  useEffect(() => {
    commerceApi
      .getAnalyticsSettings()
      .then((response) => {
        setSettings(response);
        setValue("metaPixelId", response.metaPixelId ?? "");
        setValue("enabled", response.enabled);
      })
      .catch(() => setLoadError("Could not load analytics settings."));
  }, [setValue]);

  const enabled = watch("enabled");

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    setSavedNotice(null);
    try {
      const updated = await commerceApi.saveAnalyticsSettings(values);
      setSettings(updated);
      setSavedNotice("Analytics settings saved. Your access token is encrypted and won't be shown again.");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not save analytics settings.");
    }
  }

  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <h1>Analytics</h1>

      {loadError ? (
        <div className="banner banner-danger" role="alert">
          {loadError}
        </div>
      ) : null}

      {settings ? (
        <div
          className="panel"
          style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span className="field-hint">CAPI access token</span>
            <span>{settings.hasCapiToken ? "•••••••• (saved)" : "Not set"}</span>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
      >
        <TextField
          label="Meta Pixel ID"
          hint={!errors.metaPixelId ? "From Meta Events Manager - fires the browser Pixel on your storefront." : undefined}
          error={errors.metaPixelId?.message}
          {...register("metaPixelId")}
        />

        <PasswordField
          label="Conversions API access token"
          hint={
            !errors.metaCapiToken
              ? "Only ever stored encrypted; never shown again after saving. Used for server-side Purchase events."
              : undefined
          }
          error={errors.metaCapiToken?.message}
          {...register("metaCapiToken")}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setValue("enabled", event.target.checked)}
          />
          Enabled
        </label>

        {savedNotice ? (
          <div className="banner banner-success" role="status">
            {savedNotice}
          </div>
        ) : null}
        {formError ? (
          <div className="banner banner-danger" role="alert">
            {formError}
          </div>
        ) : null}

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save analytics settings"}
        </button>
      </form>
    </div>
  );
}

export default function AnalyticsSettingsPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <AnalyticsSettingsInner />
      </DashboardLayout>
    </RequireAuth>
  );
}
