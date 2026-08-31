"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  checkoutRequestSchema,
  type CheckoutRequest,
  type DeliveryQuoteResponse,
} from "@platform/shared-types";
import { useSite } from "../../../../components/SiteProvider";
import { useCart } from "../../../../components/CartContext";
import { cartApi } from "../../../../lib/cartApi";
import { ApiError } from "../../../../lib/apiClient";
import { formatCents } from "../../../../lib/money";
import { getAttribution } from "../../../../lib/attribution";
import { initiateCheckout } from "../../../../lib/analytics/pixelEvents";

export default function CheckoutPage(): React.ReactElement {
  const { subdomain, site } = useSite();
  const collectionMethod = site.payment.collectionMethod;
  const { cart, loading: cartLoading } = useCart();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [placedDirectly, setPlacedDirectly] = useState(false);
  const [quote, setQuote] = useState<DeliveryQuoteResponse | null>(null);
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

  async function onSubmit(values: CheckoutRequest): Promise<void> {
    setSubmitError(null);
    try {
      const result = await cartApi.checkout(subdomain, { ...values, attribution: getAttribution() });
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
        {quote ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Delivery</span>
              <span className="text-ink">
                {quote.qualifiesForFreeDelivery ? "Free" : formatCents(quote.feeCents, currency)}
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
                {formatCents(cart.subtotalCents + quote.feeCents + quote.vat.amountCents, currency)}
              </span>
            </div>
          </>
        ) : (
          <div className="mt-2 flex justify-between border-t border-line pt-2 font-medium text-ink">
            <span>Total</span>
            <span>{formatCents(cart.subtotalCents, currency)}</span>
          </div>
        )}
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
          <input
            id="deliveryState"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
            {...register("deliveryState")}
          />
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
