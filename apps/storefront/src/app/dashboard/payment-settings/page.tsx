"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  paymentProviderKeySchema,
  paymentModeSchema,
  paymentCollectionMethodSchema,
  type PaymentSettingsResponse,
} from "@platform/shared-types";
import type { ReauthFormValues } from "../../../components/dashboard/ReauthModal";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { TextField } from "../../../components/dashboard/TextField";
import { PasswordField } from "../../../components/dashboard/PasswordField";
import { ReauthModal } from "../../../components/dashboard/ReauthModal";
import { useAuth } from "../../../components/dashboard/AuthContext";
import { commerceApi } from "../../../lib/commerceApi";
import { ApiError } from "../../../lib/apiClient";

const formSchema = z
  .object({
    collectionMethod: paymentCollectionMethodSchema,
    provider: paymentProviderKeySchema.optional(),
    publicKey: z.string().trim().optional(),
    secretKey: z.string().trim().optional(),
    mode: paymentModeSchema.optional(),
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

function PaymentSettingsInner(): React.ReactElement {
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
    commerceApi
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
      const updated = await commerceApi.savePaymentSettings({ ...values, ...(reauth ?? {}) });
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
    <div
      style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      <h1>Payment settings</h1>

      {loadError ? (
        <div className="banner banner-danger" role="alert">
          {loadError}
        </div>
      ) : null}

      {settings ? (
        <div
          className="panel"
          style={{
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span className="field-hint">Collection method</span>
            <span>
              {settings.collectionMethod === "cod"
                ? "Cash on delivery only"
                : settings.collectionMethod === "both"
                  ? "COD + Prepaid"
                  : "Prepaid only"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span className="field-hint">Current provider</span>
            <span>{settings.provider ?? "Not configured"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span className="field-hint">Mode</span>
            <span>{settings.mode ?? "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span className="field-hint">Secret key</span>
            <span>{settings.hasSecretKey ? "•••••••• (saved)" : "Not set"}</span>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
      >
        <Controller
          control={control}
          name="collectionMethod"
          render={({ field }) => (
            <div className="field">
              <span className="field-label">How do you get paid?</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  <input
                    type="radio"
                    checked={field.value === "cod"}
                    onChange={() => field.onChange("cod")}
                  />
                  Cash on delivery only — no payment gateway needed
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  <input
                    type="radio"
                    checked={field.value === "prepaid"}
                    onChange={() => field.onChange("prepaid")}
                  />
                  Prepaid only — buyers pay online at checkout
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
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
            <div className="field">
              <label className="field-label" htmlFor="provider">
                Provider
              </label>
              <select id="provider" className="text-input" {...register("provider")}>
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
                <div className="field">
                  <span className="field-label">Mode</span>
              <div style={{ display: "flex", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  <input
                    type="radio"
                    checked={field.value === "test"}
                    onChange={() => field.onChange("test")}
                  />
                  Test
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
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
  );
}

export default function PaymentSettingsPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <PaymentSettingsInner />
      </DashboardLayout>
    </RequireAuth>
  );
}
