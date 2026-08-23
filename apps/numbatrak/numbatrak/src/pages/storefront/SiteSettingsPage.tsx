import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageLayout } from "../../components/layout/PageLayout";
import { TextField } from "../../components/storefront/TextField";
import { useAuth } from "../../auth/AuthProvider";
import {
  storefrontSettingsApi,
  type TenantSettingsResponse,
} from "../../services/storefrontSettings";
import { ApiError } from "../../lib/apiClient";

const subdomainFormSchema = z.object({
  subdomain: z.string().trim().min(3, "At least 3 characters").max(63),
});
type SubdomainFormValues = z.infer<typeof subdomainFormSchema>;

export function SiteSettingsPage() {
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
      const data = await storefrontSettingsApi.getTenantSettings();
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
      await storefrontSettingsApi.updateTenantSettings({ subdomain: values.subdomain });
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
      await storefrontSettingsApi.updateTenantSettings({ published: !settings.published });
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
      await storefrontSettingsApi.updateTenantSettings({ showProductGrid: !settings.showProductGrid });
      await load();
    } catch (error) {
      setToggleError(
        error instanceof ApiError ? error.message : "Could not update the product grid setting.",
      );
    }
  }

  return (
    <PageLayout>
      <div className="max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Site settings</h1>

        {loadError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {loadError}
          </div>
        ) : !settings ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <form onSubmit={handleSubmit(onSubmitSubdomain)} noValidate className="flex flex-col gap-3">
              <TextField
                label="Subdomain"
                hint={!errors.subdomain ? "yourshop.numbatrak.io" : undefined}
                error={errors.subdomain?.message}
                {...register("subdomain")}
              />
              {subdomainError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {subdomainError}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 w-fit"
              >
                {isSubmitting ? "Saving…" : "Save subdomain"}
              </button>
            </form>

            {savedNotice ? (
              <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground" role="status">
                {savedNotice}
              </div>
            ) : null}

            <div className="p-4 rounded-lg border border-border bg-card space-y-3">
              <label className="flex items-center justify-between text-sm">
                <span className="text-foreground">Publish your storefront</span>
                <input
                  type="checkbox"
                  checked={settings.published}
                  onChange={() => void handleTogglePublished()}
                />
              </label>
              <label className="flex items-center justify-between text-sm">
                <span className="text-foreground">Show a live product grid on your storefront</span>
                <input
                  type="checkbox"
                  checked={settings.showProductGrid}
                  onChange={() => void handleToggleProductGrid()}
                />
              </label>
              {toggleError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {toggleError}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
