import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageLayout } from "../../components/layout/PageLayout";
import { TextField } from "../../components/storefront/TextField";
import { storefrontSettingsApi } from "../../services/storefrontSettings";
import { ApiError } from "../../lib/apiClient";
import { sanitizeDecimalInput } from "../../utils/numericInput";
import { nigeriaStates } from "../../constants/nigeriaStates";

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

function DeliverySettingsInner() {
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
    storefrontSettingsApi
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

  const deliveryFeeAmountField = register("deliveryFeeAmount");
  const freeDeliveryThresholdAmountField = register("freeDeliveryThresholdAmount");
  const vatRatePercentField = register("vatRatePercent");

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    setSavedNotice(null);
    try {
      await storefrontSettingsApi.saveDeliverySettings({
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

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Delivery &amp; VAT</h1>

      {loadError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {loadError}
          </div>
        ) : !loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <TextField
              label="Delivery fee"
              type="text"
              inputMode="decimal"
              hint={!errors.deliveryFeeAmount ? "Flat fee charged on every order, unless waived below." : undefined}
              error={errors.deliveryFeeAmount?.message}
              {...deliveryFeeAmountField}
              onChange={(e) => {
                e.target.value = sanitizeDecimalInput(e.target.value);
                void deliveryFeeAmountField.onChange(e);
              }}
            />

            <TextField
              label="Free delivery over"
              type="text"
              inputMode="decimal"
              hint={
                !errors.freeDeliveryThresholdAmount
                  ? "Optional - leave blank to always charge the delivery fee."
                  : undefined
              }
              error={errors.freeDeliveryThresholdAmount?.message}
              {...freeDeliveryThresholdAmountField}
              onChange={(e) => {
                e.target.value = sanitizeDecimalInput(e.target.value);
                void freeDeliveryThresholdAmountField.onChange(e);
              }}
            />

            <label className="flex items-center gap-2 text-sm text-foreground">
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
                type="text"
                inputMode="decimal"
                hint={!errors.vatRatePercent ? "Applied to subtotal + delivery fee." : undefined}
                error={errors.vatRatePercent?.message}
                {...vatRatePercentField}
                onChange={(e) => {
                  e.target.value = sanitizeDecimalInput(e.target.value);
                  void vatRatePercentField.onChange(e);
                }}
              />
            ) : null}

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
              {isSubmitting ? "Saving…" : "Save delivery settings"}
            </button>
          </form>
        )}
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

function DeliveryZonesSection() {
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
    storefrontSettingsApi
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
      await storefrontSettingsApi.saveDeliveryZones({
        rates: values.rates.map((rate) => ({
          state: rate.state,
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
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
        {loadError}
      </div>
    );
  }
  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Delivery zones</h2>
        <p className="text-sm text-muted-foreground">
          Set a per-state fee to override the flat delivery fee above for that state.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <select
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              defaultValue={field.state}
              {...register(`rates.${index}.state` as const)}
            >
              <option value="" disabled>
                Select a state
              </option>
              {nigeriaStates.map((state) => (
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
              aria-label="Fee"
              className="h-10 w-32 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              {...register(`rates.${index}.feeAmount` as const)}
            />
            {errors.rates?.[index]?.feeAmount ? (
              <span className="text-sm text-destructive" role="alert">
                {errors.rates[index]?.feeAmount?.message}
              </span>
            ) : null}
            <button
              type="button"
              className="text-sm text-muted-foreground hover:underline"
              onClick={() => remove(index)}
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          className="inline-flex w-fit items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          onClick={() => append({ state: "", feeAmount: 0 })}
        >
          Add zone
        </button>

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
          className="inline-flex w-fit items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Save delivery zones"}
        </button>
      </form>
    </div>
  );
}

export function DeliverySettingsPage() {
  return (
    <PageLayout>
      <div className="space-y-10">
        <DeliverySettingsInner />
        <DeliveryZonesSection />
      </div>
    </PageLayout>
  );
}
