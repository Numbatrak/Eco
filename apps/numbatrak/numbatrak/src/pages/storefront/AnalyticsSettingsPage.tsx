import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageLayout } from "../../components/layout/PageLayout";
import { TextField } from "../../components/storefront/TextField";
import { PasswordField } from "../../components/storefront/PasswordField";
import {
  storefrontSettingsApi,
  type AnalyticsSettingsResponse,
} from "../../services/storefrontSettings";
import { ApiError } from "../../lib/apiClient";

const formSchema = z.object({
  metaPixelId: z.string().trim().min(1, "Pixel ID is required"),
  metaCapiToken: z.string().trim().min(1, "CAPI access token is required"),
  enabled: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

export function AnalyticsSettingsPage() {
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
    storefrontSettingsApi
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
      const updated = await storefrontSettingsApi.saveAnalyticsSettings(values);
      setSettings(updated);
      setSavedNotice("Analytics settings saved. Your access token is encrypted and won't be shown again.");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not save analytics settings.");
    }
  }

  return (
    <PageLayout>
      <div className="max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>

        {loadError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {loadError}
          </div>
        ) : null}

        {settings ? (
          <div className="p-4 rounded-lg border border-border bg-card space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CAPI access token</span>
              <span className="text-foreground">{settings.hasCapiToken ? "•••••••• (saved)" : "Not set"}</span>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setValue("enabled", event.target.checked)}
            />
            Enabled
          </label>

          {savedNotice ? (
            <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground" role="status">
              {savedNotice}
            </div>
          ) : null}
          {formError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {formError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 w-fit"
          >
            {isSubmitting ? "Saving…" : "Save analytics settings"}
          </button>
        </form>
      </div>
    </PageLayout>
  );
}
