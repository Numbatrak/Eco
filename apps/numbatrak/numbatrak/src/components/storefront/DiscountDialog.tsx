import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { TextField } from "./TextField";
import {
  storefrontSettingsApi,
  type DiscountRequest,
  type DiscountResponse,
  type DiscountType,
} from "../../services/storefrontSettings";
import { ApiError } from "../../lib/apiClient";

const DISCOUNT_TYPES: { value: DiscountType; label: string }[] = [
  { value: "amount_off_order", label: "Amount off order" },
  { value: "amount_off_products", label: "Amount off products" },
  { value: "buy_x_get_y", label: "Buy X, get Y" },
  { value: "free_shipping", label: "Free shipping" },
];

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  code: z.string().trim().max(64),
  active: z.boolean(),
  type: z.enum(["amount_off_order", "amount_off_products", "buy_x_get_y", "free_shipping"]),
  // amount_off_order / amount_off_products
  valueType: z.enum(["percentage", "fixed_amount"]),
  valueAmount: z.coerce.number().nonnegative(),
  minimumSubtotalAmount: z.coerce.number().nonnegative().optional(),
  // amount_off_products
  targetProductIds: z.string().trim(),
  targetCollectionIds: z.string().trim(),
  // buy_x_get_y
  buyProductId: z.string().trim(),
  buyQuantity: z.coerce.number().int().positive(),
  getProductId: z.string().trim(),
  getQuantity: z.coerce.number().int().positive(),
  getDiscountPercent: z.coerce.number().int().min(1).max(100),
});
type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
  title: "",
  code: "",
  active: true,
  type: "amount_off_order",
  valueType: "percentage",
  valueAmount: 0,
  minimumSubtotalAmount: undefined,
  targetProductIds: "",
  targetCollectionIds: "",
  buyProductId: "",
  buyQuantity: 1,
  getProductId: "",
  getQuantity: 1,
  getDiscountPercent: 100,
};

function splitIds(value: string): string[] {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = create a new discount. */
  discount: DiscountResponse | null;
  onSaved: () => void;
}

export function DiscountDialog({ open, onOpenChange, discount, onSaved }: DiscountDialogProps) {
  const isEditing = discount != null;
  const [formError, setFormError] = useState<string | null>(null);

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
    if (!open) return;
    setFormError(null);
    if (!discount) {
      reset(DEFAULT_VALUES);
      return;
    }
    const config = discount.config;
    reset({
      ...DEFAULT_VALUES,
      title: discount.title,
      code: discount.code ?? "",
      active: discount.active,
      type: config.type,
      valueType: "valueType" in config ? config.valueType : "percentage",
      valueAmount:
        "value" in config
          ? config.valueType === "percentage"
            ? config.value
            : config.value / 100
          : 0,
      minimumSubtotalAmount:
        "minimumSubtotalCents" in config && config.minimumSubtotalCents != null
          ? config.minimumSubtotalCents / 100
          : undefined,
      targetProductIds: "targetProductIds" in config ? config.targetProductIds.join(", ") : "",
      targetCollectionIds: "targetCollectionIds" in config ? config.targetCollectionIds.join(", ") : "",
      buyProductId: "buyProductId" in config ? config.buyProductId : "",
      buyQuantity: "buyQuantity" in config ? config.buyQuantity : 1,
      getProductId: "getProductId" in config ? config.getProductId : "",
      getQuantity: "getQuantity" in config ? config.getQuantity : 1,
      getDiscountPercent: "getDiscountPercent" in config ? config.getDiscountPercent : 100,
    });
  }, [open, discount, reset]);

  const type = watch("type");
  const valueType = watch("valueType");
  const active = watch("active");

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    const minimumSubtotalCents =
      values.minimumSubtotalAmount != null ? Math.round(values.minimumSubtotalAmount * 100) : undefined;

    let config: DiscountRequest["config"];
    switch (values.type) {
      case "amount_off_order":
        config = {
          type: "amount_off_order",
          valueType: values.valueType,
          value: values.valueType === "percentage" ? values.valueAmount : Math.round(values.valueAmount * 100),
          minimumSubtotalCents,
        };
        break;
      case "amount_off_products":
        config = {
          type: "amount_off_products",
          valueType: values.valueType,
          value: values.valueType === "percentage" ? values.valueAmount : Math.round(values.valueAmount * 100),
          targetProductIds: splitIds(values.targetProductIds),
          targetCollectionIds: splitIds(values.targetCollectionIds),
        };
        break;
      case "buy_x_get_y":
        config = {
          type: "buy_x_get_y",
          buyProductId: values.buyProductId.trim(),
          buyQuantity: values.buyQuantity,
          getProductId: values.getProductId.trim(),
          getQuantity: values.getQuantity,
          getDiscountPercent: values.getDiscountPercent,
        };
        break;
      case "free_shipping":
        config = { type: "free_shipping", minimumSubtotalCents };
        break;
    }

    const payload: DiscountRequest = {
      title: values.title,
      code: values.code.trim() || null,
      active: values.active,
      config,
    };

    try {
      if (isEditing && discount) {
        await storefrontSettingsApi.updateDiscount(discount.id, payload);
      } else {
        await storefrontSettingsApi.createDiscount(payload);
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not save this discount.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit discount" : "Add discount"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <TextField label="Title" error={errors.title?.message} {...register("title")} />

          <TextField
            label="Code"
            hint={!errors.code ? "Leave blank for an automatic discount (applies without a code)." : undefined}
            error={errors.code?.message}
            {...register("code")}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="discount-type">
              Type
            </label>
            <select
              id="discount-type"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              {...register("type")}
            >
              {DISCOUNT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {(type === "amount_off_order" || type === "amount_off_products") && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="value-type">
                  Discount value type
                </label>
                <select
                  id="value-type"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  {...register("valueType")}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed_amount">Fixed amount</option>
                </select>
              </div>
              <TextField
                label={valueType === "percentage" ? "Percent off" : "Amount off"}
                type="number"
                min={0}
                step="0.01"
                error={errors.valueAmount?.message}
                {...register("valueAmount")}
              />
            </>
          )}

          {type === "amount_off_products" && (
            <>
              <TextField
                label="Target product IDs"
                hint="Comma-separated product IDs this discount applies to."
                error={errors.targetProductIds?.message}
                {...register("targetProductIds")}
              />
              <TextField
                label="Target collection IDs"
                hint="Comma-separated collection IDs this discount applies to."
                error={errors.targetCollectionIds?.message}
                {...register("targetCollectionIds")}
              />
            </>
          )}

          {(type === "amount_off_order" || type === "free_shipping") && (
            <TextField
              label="Minimum subtotal (optional)"
              type="number"
              min={0}
              step="0.01"
              error={errors.minimumSubtotalAmount?.message}
              {...register("minimumSubtotalAmount")}
            />
          )}

          {type === "buy_x_get_y" && (
            <>
              <TextField label="Buy product ID" error={errors.buyProductId?.message} {...register("buyProductId")} />
              <TextField
                label="Buy quantity"
                type="number"
                min={1}
                error={errors.buyQuantity?.message}
                {...register("buyQuantity")}
              />
              <TextField label="Get product ID" error={errors.getProductId?.message} {...register("getProductId")} />
              <TextField
                label="Get quantity"
                type="number"
                min={1}
                error={errors.getQuantity?.message}
                {...register("getQuantity")}
              />
              <TextField
                label="Get discount percent"
                hint="100 = the item is free."
                type="number"
                min={1}
                max={100}
                error={errors.getDiscountPercent?.message}
                {...register("getDiscountPercent")}
              />
            </>
          )}

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={active} onChange={(event) => setValue("active", event.target.checked)} />
            Active
          </label>

          {formError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {formError}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
