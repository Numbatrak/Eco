import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageLayout } from "../../components/layout/PageLayout";
import { TextField } from "../../components/storefront/TextField";
import { storefrontSettingsApi } from "../../services/storefrontSettings";
import { ApiError } from "../../lib/apiClient";

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

export function DeliverySettingsPage() {
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
    <PageLayout>
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
    </PageLayout>
  );
}
