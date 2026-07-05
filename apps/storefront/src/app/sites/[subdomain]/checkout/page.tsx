"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutRequestSchema, type CheckoutRequest } from "@platform/shared-types";
import { useSite } from "../../../../components/SiteProvider";
import { useCart } from "../../../../components/CartContext";
import { cartApi } from "../../../../lib/cartApi";
import { ApiError } from "../../../../lib/apiClient";
import { formatCents } from "../../../../lib/money";

export default function CheckoutPage(): React.ReactElement {
  const { subdomain } = useSite();
  const { cart, loading: cartLoading } = useCart();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutRequest>({
    resolver: zodResolver(checkoutRequestSchema),
  });

  async function onSubmit(values: CheckoutRequest): Promise<void> {
    setSubmitError(null);
    try {
      const result = await cartApi.checkout(subdomain, values);
      setRedirecting(true);
      window.location.href = result.checkoutUrl;
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
        <div className="mt-2 flex justify-between border-t border-line pt-2 font-medium text-ink">
          <span>Subtotal</span>
          <span>{formatCents(cart.subtotalCents, currency)}</span>
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

        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}

        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
          disabled={isSubmitting || redirecting}
        >
          {redirecting ? "Redirecting to payment…" : isSubmitting ? "Placing order…" : "Continue to payment"}
        </button>
      </form>
    </div>
  );
}
