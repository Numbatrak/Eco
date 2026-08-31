"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  checkoutRequestSchema,
  type CheckoutRequest,
  type DeliveryQuoteResponse,
  type DiscountCodePreviewResponse,
  NIGERIA_STATES,
} from "@platform/shared-types";
import { useSite } from "../../../../components/SiteProvider";
import { useCart } from "../../../../components/CartContext";
import { cartApi } from "../../../../lib/cartApi";
import { ApiError } from "../../../../lib/apiClient";
import { formatCents } from "../../../../lib/money";
import { getAttribution, getLastAttribution } from "../../../../lib/attribution";
import { initiateCheckout } from "../../../../lib/analytics/pixelEvents";

export default function CheckoutPage(): React.ReactElement {
  const { subdomain, site } = useSite();
  const collectionMethod = site.payment.collectionMethod;
  const { cart, loading: cartLoading } = useCart();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [placedDirectly, setPlacedDirectly] = useState(false);
  const [quote, setQuote] = useState<DeliveryQuoteResponse | null>(null);
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; preview: DiscountCodePreviewResponse } | null>(
    null,
  );
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);
  const firedInitiateCheckout = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutRequest>({
    resolver: zodResolver(checkoutRequestSchema),
    defaultValues: { paymentMethod: collectionMethod === "prepaid" ? "online" : "cod" },
  });
  const selectedPaymentMethod = watch("paymentMethod");
  // For "both", the button label should follow the buyer's actual radio
  // choice, not just the tenant-level setting.
  const isCodSubmission =
    collectionMethod === "cod" || (collectionMethod === "both" && selectedPaymentMethod === "cod");

  useEffect(() => {
    if (!cart || cart.items.length === 0) return;
    cartApi
      .getDeliveryQuote(subdomain, cart.subtotalCents)
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [subdomain, cart?.subtotalCents, cart?.items.length]);

  useEffect(() => {
    if (!cart || cart.items.length === 0 || firedInitiateCheckout.current) return;
    firedInitiateCheckout.current = true;
    initiateCheckout(
      cart.subtotalCents,
      cart.currency ?? "NGN",
      cart.items.map((item) => item.productId),
    );
  }, [cart]);

  async function handleApplyDiscount(): Promise<void> {
    const code = discountCodeInput.trim();
    if (!code) return;
    setDiscountError(null);
    setCheckingDiscount(true);
    try {
      const preview = await cartApi.validateDiscountCode(subdomain, code);
      if (!preview.valid) {
        setDiscountError(preview.message ?? "This code isn't valid.");
        setAppliedDiscount(null);
        return;
      }
      setAppliedDiscount({ code, preview });
    } catch {
      setDiscountError("Could not check this code. Please try again.");
      setAppliedDiscount(null);
    } finally {
      setCheckingDiscount(false);
    }
  }

  function handleRemoveDiscount(): void {
    setAppliedDiscount(null);
    setDiscountCodeInput("");
    setDiscountError(null);
  }

  async function onSubmit(values: CheckoutRequest): Promise<void> {
    setSubmitError(null);
    try {
      const result = await cartApi.checkout(subdomain, {
        ...values,
        attribution: getAttribution(),
        lastAttribution: getLastAttribution(),
        discountCode: appliedDiscount?.code,
      });
      setRedirecting(true);
      // Null checkoutUrl = a COD order, already placed - nothing to pay for
      // online, so go straight to the order status page instead.
      if (result.checkoutUrl === null) {
        setPlacedDirectly(true);
        window.location.href = `/sites/${subdomain}/order/${result.orderId}/status`;
      } else {
        window.location.href = result.checkoutUrl;
      }
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  if (cartLoading) {
    return <p className="text-center text-sm text-muted">Loading…</p>;
  }

  if (!cart || cart.items.length === 0) {
    return <p className="text-center text-sm text-muted">Your cart is empty.</p>;
  }

  const currency = cart.currency ?? "NGN";

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-heading text-xl text-ink">Checkout</h1>

      <div className="mt-4 flex flex-col gap-2 rounded-lg border border-line bg-panel p-4">
        {cart.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-ink">
              {item.name} × {item.quantity}
            </span>
            <span className="text-muted">{formatCents(item.lineTotalCents, currency)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-muted">Subtotal</span>
          <span className="text-ink">{formatCents(cart.subtotalCents, currency)}</span>
        </div>
        {appliedDiscount ? (
          <div className="flex justify-between text-sm">
            <span className="text-muted">Discount ({appliedDiscount.code})</span>
            <span className="text-ink">
              {appliedDiscount.preview.freeShipping
                ? "Free shipping"
                : `-${formatCents(appliedDiscount.preview.amountCents, currency)}`}
            </span>
          </div>
        ) : null}
        {quote ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Delivery</span>
              <span className="text-ink">
                {quote.qualifiesForFreeDelivery || appliedDiscount?.preview.freeShipping
                  ? "Free"
                  : formatCents(quote.feeCents, currency)}
              </span>
            </div>
            {quote.vat.enabled ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted">VAT</span>
                <span className="text-ink">{formatCents(quote.vat.amountCents, currency)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-line pt-2 font-medium text-ink">
              <span>Total</span>
              <span>
                {formatCents(
                  Math.max(0, cart.subtotalCents - (appliedDiscount?.preview.amountCents ?? 0)) +
                    (appliedDiscount?.preview.freeShipping ? 0 : quote.feeCents) +
                    quote.vat.amountCents,
                  currency,
                )}
              </span>
            </div>
          </>
        ) : (
          <div className="mt-2 flex justify-between border-t border-line pt-2 font-medium text-ink">
            <span>Total</span>
            <span>{formatCents(cart.subtotalCents, currency)}</span>
          </div>
        )}

        <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
          {appliedDiscount ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink">Code &ldquo;{appliedDiscount.code}&rdquo; applied</span>
              <button type="button" className="text-xs text-muted underline" onClick={handleRemoveDiscount}>
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
                placeholder="Discount code"
                value={discountCodeInput}
                onChange={(event) => setDiscountCodeInput(event.target.value)}
              />
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm text-ink disabled:opacity-60"
                disabled={checkingDiscount || !discountCodeInput.trim()}
                onClick={() => void handleApplyDiscount()}
              >
                {checkingDiscount ? "Checking…" : "Apply"}
              </button>
            </div>
          )}
          {discountError ? <p className="text-xs text-danger">{discountError}</p> : null}
        </div>
      </div>

      <form
        className="mt-6 flex flex-col gap-4"
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink" htmlFor="customerName">
            Full name
          </label>
          <input
            id="customerName"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
            {...register("customerName")}
          />
          {errors.customerName ? (
            <p className="text-xs text-danger">{errors.customerName.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink" htmlFor="customerEmail">
            Email
          </label>
          <input
            id="customerEmail"
            type="email"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
            {...register("customerEmail")}
          />
          {errors.customerEmail ? (
            <p className="text-xs text-danger">{errors.customerEmail.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink" htmlFor="customerPhone">
            Phone (optional)
          </label>
          <input
            id="customerPhone"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
            {...register("customerPhone")}
          />
          {errors.customerPhone ? (
            <p className="text-xs text-danger">{errors.customerPhone.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink" htmlFor="deliveryAddress">
            Delivery address
          </label>
          <input
            id="deliveryAddress"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
            {...register("deliveryAddress")}
          />
          {errors.deliveryAddress ? (
            <p className="text-xs text-danger">{errors.deliveryAddress.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink" htmlFor="deliveryCity">
            City
          </label>
          <input
            id="deliveryCity"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
            {...register("deliveryCity")}
          />
          {errors.deliveryCity ? (
            <p className="text-xs text-danger">{errors.deliveryCity.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink" htmlFor="deliveryState">
            State
          </label>
          <select
            id="deliveryState"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
            defaultValue=""
            {...register("deliveryState")}
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
          {errors.deliveryState ? (
            <p className="text-xs text-danger">{errors.deliveryState.message}</p>
          ) : null}
        </div>

        {collectionMethod === "both" ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Payment method</span>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" value="cod" {...register("paymentMethod")} />
              Pay on delivery
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" value="online" {...register("paymentMethod")} />
              Pay now
            </label>
          </div>
        ) : collectionMethod === "cod" ? (
          <p className="text-sm text-muted">Pay with cash when your order is delivered.</p>
        ) : null}

        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}

        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
          disabled={isSubmitting || redirecting}
        >
          {redirecting
            ? placedDirectly
              ? "Placing order…"
              : "Redirecting to payment…"
            : isSubmitting
              ? "Placing order…"
              : isCodSubmission
                ? "Place order"
                : "Continue to payment"}
        </button>
      </form>
    </div>
  );
}
