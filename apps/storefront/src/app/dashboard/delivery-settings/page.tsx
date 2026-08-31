"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { NIGERIA_STATES } from "@platform/shared-types";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { TextField } from "../../../components/dashboard/TextField";
import { commerceApi } from "../../../lib/commerceApi";
import { ApiError } from "../../../lib/apiClient";

const formSchema = z.object({
  deliveryFeeAmount: z.coerce.number().nonnegative("Fee can't be negative"),
  freeDeliveryThresholdAmount: z.coerce.number().nonnegative("Threshold can't be negative").optional(),
  vatEnabled: z.boolean(),
  vatRatePercent: z.coerce.number().min(0).max(100),
});
type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
  deliveryFeeAmount: 0,
  freeDeliveryThresholdAmount: undefined,
  vatEnabled: false,
  vatRatePercent: 0,
};

function DeliverySettingsInner(): React.ReactElement {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    commerceApi
      .getDeliverySettings()
      .then((settings) => {
        reset({
          deliveryFeeAmount: settings.deliveryFeeCents / 100,
          freeDeliveryThresholdAmount:
            settings.freeDeliveryThresholdCents != null
              ? settings.freeDeliveryThresholdCents / 100
              : undefined,
          vatEnabled: settings.vatEnabled,
          vatRatePercent: settings.vatRateBps / 100,
        });
        setLoaded(true);
      })
      .catch(() => setLoadError("Could not load delivery settings."));
  }, [reset]);

  const vatEnabled = watch("vatEnabled");

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    setSavedNotice(null);
    try {
      await commerceApi.saveDeliverySettings({
        deliveryFeeCents: Math.round(values.deliveryFeeAmount * 100),
        freeDeliveryThresholdCents:
          values.freeDeliveryThresholdAmount != null
            ? Math.round(values.freeDeliveryThresholdAmount * 100)
            : null,
        vatEnabled: values.vatEnabled,
        vatRateBps: Math.round(values.vatRatePercent * 100),
      });
      setSavedNotice("Delivery settings saved.");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not save delivery settings.");
    }
  }

  if (loadError) {
    return (
      <div className="banner banner-danger" role="alert">
        {loadError}
      </div>
    );
  }
  if (!loaded) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <h1>Delivery &amp; VAT</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
      >
        <TextField
          label="Delivery fee"
          type="number"
          min={0}
          step="0.01"
          hint={!errors.deliveryFeeAmount ? "Flat fee charged on every order, unless waived below." : undefined}
          error={errors.deliveryFeeAmount?.message}
          {...register("deliveryFeeAmount")}
        />

        <TextField
          label="Free delivery over"
          type="number"
          min={0}
          step="0.01"
          hint={
            !errors.freeDeliveryThresholdAmount
              ? "Optional - leave blank to always charge the delivery fee."
              : undefined
          }
          error={errors.freeDeliveryThresholdAmount?.message}
          {...register("freeDeliveryThresholdAmount")}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={vatEnabled}
            onChange={(event) => setValue("vatEnabled", event.target.checked)}
          />
          Charge VAT
        </label>

        {vatEnabled ? (
          <TextField
            label="VAT rate (%)"
            type="number"
            min={0}
            max={100}
            step="0.1"
            hint={!errors.vatRatePercent ? "Applied to subtotal + delivery fee." : undefined}
            error={errors.vatRatePercent?.message}
            {...register("vatRatePercent")}
          />
        ) : null}

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
          {isSubmitting ? "Saving…" : "Save delivery settings"}
        </button>
      </form>
    </div>
  );
}

const zonesFormSchema = z.object({
  rates: z.array(
    z.object({
      state: z.string().min(1, "Pick a state"),
      feeAmount: z.coerce.number().nonnegative("Fee can't be negative"),
    }),
  ),
});
type ZonesFormValues = z.infer<typeof zonesFormSchema>;

function DeliveryZonesSection(): React.ReactElement {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ZonesFormValues>({
    resolver: zodResolver(zonesFormSchema),
    defaultValues: { rates: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "rates" });

  useEffect(() => {
    commerceApi
      .getDeliveryZones()
      .then(({ rates }) => {
        reset({ rates: rates.map((rate) => ({ state: rate.state, feeAmount: rate.feeCents / 100 })) });
        setLoaded(true);
      })
      .catch(() => setLoadError("Could not load delivery zones."));
  }, [reset]);

  async function onSubmit(values: ZonesFormValues): Promise<void> {
    setFormError(null);
    setSavedNotice(null);
    try {
      await commerceApi.saveDeliveryZones({
        rates: values.rates.map((rate) => ({
          state: rate.state as (typeof NIGERIA_STATES)[number],
          feeCents: Math.round(rate.feeAmount * 100),
        })),
      });
      setSavedNotice("Delivery zones saved.");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not save delivery zones.");
    }
  }

  if (loadError) {
    return (
      <div className="banner banner-danger" role="alert">
        {loadError}
      </div>
    );
  }
  if (!loaded) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div>
        <h2 style={{ margin: 0 }}>Delivery zones</h2>
        <p className="field-hint">
          Set a per-state fee to override the flat delivery fee above for that state.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
      >
        {fields.map((field, index) => (
          <div key={field.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <select
              className="text-input"
              style={{ flex: 1 }}
              defaultValue={field.state}
              {...register(`rates.${index}.state` as const)}
            >
              <option value="" disabled>
                Select a state
              </option>
              {NIGERIA_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Fee"
              className="text-input"
              aria-label="Fee"
              {...register(`rates.${index}.feeAmount` as const)}
            />
            {errors.rates?.[index]?.feeAmount ? (
              <span className="field-error" role="alert">
                {errors.rates[index]?.feeAmount?.message}
              </span>
            ) : null}
            <button type="button" className="btn-link" onClick={() => remove(index)}>
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => append({ state: "", feeAmount: 0 })}
          style={{ alignSelf: "flex-start" }}
        >
          Add zone
        </button>

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

        <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ alignSelf: "flex-start" }}>
          {isSubmitting ? "Saving…" : "Save delivery zones"}
        </button>
      </form>
    </div>
  );
}

export default function DeliverySettingsPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <DeliverySettingsInner />
          <DeliveryZonesSection />
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
