import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageLayout } from "../../components/layout/PageLayout";
import { TextField } from "../../components/storefront/TextField";
import { PasswordField } from "../../components/storefront/PasswordField";
import { ReauthModal, type ReauthFormValues } from "../../components/storefront/ReauthModal";
import { useAuth } from "../../auth/AuthProvider";
import {
  storefrontSettingsApi,
  type PaymentSettingsResponse,
} from "../../services/storefrontSettings";
import { ApiError } from "../../lib/apiClient";

const formSchema = z
  .object({
    collectionMethod: z.enum(["cod", "prepaid", "both"]),
    provider: z.enum(["paystack", "flutterwave"]).optional(),
    publicKey: z.string().trim().optional(),
    secretKey: z.string().trim().optional(),
    mode: z.enum(["test", "live"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.collectionMethod === "cod") return;
    if (!data.provider) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["provider"], message: "Required" });
    }
    if (!data.publicKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publicKey"], message: "Public key is required" });
    }
    if (!data.secretKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["secretKey"], message: "Secret key is required" });
    }
    if (!data.mode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mode"], message: "Required" });
    }
  });
type FormValues = z.infer<typeof formSchema>;

export function PaymentSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PaymentSettingsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      collectionMethod: "prepaid",
      provider: "paystack",
      publicKey: "",
      secretKey: "",
      mode: "test",
    },
  });
  const collectionMethod = watch("collectionMethod");

  useEffect(() => {
    storefrontSettingsApi
      .getPaymentSettings()
      .then((response) => {
        setSettings(response);
        reset({
          collectionMethod: response.collectionMethod ?? "prepaid",
          provider: response.provider ?? "paystack",
          publicKey: "",
          secretKey: "",
          mode: response.mode ?? "test",
        });
      })
      .catch(() => setLoadError("Could not load payment settings."));
  }, [reset]);

  async function saveSettings(values: FormValues, reauth?: ReauthFormValues): Promise<void> {
    setFormError(null);
    setSavedNotice(null);
    try {
      const updated = await storefrontSettingsApi.savePaymentSettings({ ...values, ...(reauth ?? {}) });
      setSettings(updated);
      setSavedNotice(
        "Payment settings saved. Your secret key is encrypted and won't be shown again.",
      );
      setPendingValues(null);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Could not save payment settings.";
      if (reauth) {
        throw new ApiError(error instanceof ApiError ? error.status : 500, undefined, message);
      }
      setFormError(message);
    }
  }

  async function onSubmit(values: FormValues): Promise<void> {
    if (values.mode === "live") {
      setPendingValues(values);
      return;
    }
    await saveSettings(values);
  }

  return (
    <PageLayout>
      <div className="max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Payment settings</h1>

        {loadError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {loadError}
          </div>
        ) : null}

        {settings ? (
          <div className="p-4 rounded-lg border border-border bg-card space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Collection method</span>
              <span className="text-foreground">
                {settings.collectionMethod === "cod"
                  ? "Cash on delivery only"
                  : settings.collectionMethod === "both"
                    ? "COD + Prepaid"
                    : "Prepaid only"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current provider</span>
              <span className="text-foreground">{settings.provider ?? "Not configured"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mode</span>
              <span className="text-foreground">{settings.mode ?? "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Secret key</span>
              <span className="text-foreground">{settings.hasSecretKey ? "•••••••• (saved)" : "Not set"}</span>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Controller
            control={control}
            name="collectionMethod"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">How do you get paid?</span>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-foreground">
                    <input
                      type="radio"
                      checked={field.value === "cod"}
                      onChange={() => field.onChange("cod")}
                    />
                    Cash on delivery only — no payment gateway needed
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-foreground">
                    <input
                      type="radio"
                      checked={field.value === "prepaid"}
                      onChange={() => field.onChange("prepaid")}
                    />
                    Prepaid only — buyers pay online at checkout
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-foreground">
                    <input
                      type="radio"
                      checked={field.value === "both"}
                      onChange={() => field.onChange("both")}
                    />
                    Both — buyers choose Pay on Delivery or Pay Now
                  </label>
                </div>
              </div>
            )}
          />

          {collectionMethod !== "cod" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="provider">
                  Provider
                </label>
                <select
                  id="provider"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  {...register("provider")}
                >
                  <option value="paystack">Paystack</option>
                  <option value="flutterwave">Flutterwave</option>
                </select>
              </div>

              <TextField
                label="Public key"
                error={errors.publicKey?.message}
                {...register("publicKey")}
              />
              <PasswordField
                label="Secret key"
                hint={
                  !errors.secretKey
                    ? "Only ever stored encrypted; never shown again after saving."
                    : undefined
                }
                error={errors.secretKey?.message}
                {...register("secretKey")}
              />

              <Controller
                control={control}
                name="mode"
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Mode</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm text-foreground">
                        <input
                          type="radio"
                          checked={field.value === "test"}
                          onChange={() => field.onChange("test")}
                        />
                        Test
                      </label>
                      <label className="flex items-center gap-1.5 text-sm text-foreground">
                        <input
                          type="radio"
                          checked={field.value === "live"}
                          onChange={() => field.onChange("live")}
                        />
                        Live
                      </label>
                    </div>
                  </div>
                )}
              />
            </>
          )}

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
            {isSubmitting ? "Saving…" : "Save payment settings"}
          </button>
        </form>

        <ReauthModal
          open={pendingValues !== null}
          title="Confirm live-mode credentials"
          description="This gates real money movement, so we need to confirm it's really you."
          confirmLabel="Save live credentials"
          requireCode={Boolean(user?.twoFactorEnabled)}
          danger={false}
          onCancel={() => setPendingValues(null)}
          onConfirm={async (reauth) => {
            if (pendingValues) {
              await saveSettings(pendingValues, reauth);
            }
          }}
        />
      </div>
    </PageLayout>
  );
}
