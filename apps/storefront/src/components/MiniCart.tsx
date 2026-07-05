"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "./CartContext";
import { formatCents } from "../lib/money";

export function MiniCart(): React.ReactElement {
  const { cart, loading, updateItemQuantity, removeItem } = useCart();
  const [open, setOpen] = useState(false);

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const currency = cart?.currency ?? "NGN";

  function handleDecrease(itemId: string, quantity: number): void {
    if (quantity <= 1) {
      void removeItem(itemId);
    } else {
      void updateItemQuantity(itemId, quantity - 1);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative rounded-md border border-line px-3 py-2 text-sm"
        aria-label="Open cart"
      >
        Cart
        {itemCount > 0 ? (
          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-ink">{itemCount}</span>
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-20 flex justify-end bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-sm flex-col gap-4 bg-panel p-5"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg text-ink">Your cart</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close cart">
                ✕
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : !cart || cart.items.length === 0 ? (
              <p className="text-sm text-muted">Your cart is empty.</p>
            ) : (
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
                {cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-line pb-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">{item.name}</p>
                      <p className="text-xs text-muted">
                        {formatCents(item.unitPriceSnapshotCents, currency)} each
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-line px-2"
                          onClick={() => handleDecrease(item.id, item.quantity)}
                          aria-label={`Decrease quantity of ${item.name}`}
                        >
                          −
                        </button>
                        <span className="text-sm" aria-label={`Quantity of ${item.name}`}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="rounded border border-line px-2"
                          onClick={() => void updateItemQuantity(item.id, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="ml-2 text-xs text-danger underline"
                          onClick={() => void removeItem(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-ink">
                      {formatCents(item.lineTotalCents, currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {cart && cart.items.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-line pt-4">
                <div className="flex justify-between font-medium text-ink">
                  <span>Subtotal</span>
                  <span>{formatCents(cart.subtotalCents, currency)}</span>
                </div>
                <Link
                  href="/checkout"
                  className="rounded-md bg-accent px-4 py-2 text-center text-sm font-medium text-ink"
                  onClick={() => setOpen(false)}
                >
                  Checkout
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
