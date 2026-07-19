"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { OrderStatusResponse } from "@platform/shared-types";
import { useSite } from "../../../../../../components/SiteProvider";
import { cartApi } from "../../../../../../lib/cartApi";
import { ApiError } from "../../../../../../lib/apiClient";
import { formatCents } from "../../../../../../lib/money";
import { purchase } from "../../../../../../lib/analytics/pixelEvents";

const POLL_INTERVAL_MS = 3000;

const STATUS_COPY: Record<OrderStatusResponse["status"], { title: string; description: string }> = {
  pending: {
    title: "Confirming your payment…",
    description: "This usually only takes a few seconds.",
  },
  paid: {
    title: "Payment received",
    description: "Thanks for your order! We've sent a confirmation to your email.",
  },
  shipped: {
    title: "Order shipped",
    description: "Your order is on its way.",
  },
  delivered: {
    title: "Order delivered",
    description: "Your order has been delivered.",
  },
  failed: {
    title: "Payment failed",
    description: "Your payment didn't go through. You can go back and try again.",
  },
  cancelled: {
    title: "Order cancelled",
    description: "This order was cancelled.",
  },
};

export default function OrderStatusPage(): React.ReactElement {
  const { subdomain } = useSite();
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;

  const [status, setStatus] = useState<OrderStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firedPurchase = useRef(false);

  useEffect(() => {
    if (status?.status === "paid" && !firedPurchase.current) {
      firedPurchase.current = true;
      purchase(status.orderId, status.totalCents, status.currency);
    }
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll(): Promise<void> {
      try {
        const result = await cartApi.getOrderStatus(subdomain, orderId);
        if (cancelled) return;
        setStatus(result);
        if (result.status === "pending") {
          timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      } catch (fetchError) {
        if (cancelled) return;
        setError(fetchError instanceof ApiError ? fetchError.message : "Could not check your order status.");
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [subdomain, orderId]);

  if (error) {
    return <p className="text-center text-sm text-danger">{error}</p>;
  }

  if (!status) {
    return <p className="text-center text-sm text-muted">Loading…</p>;
  }

  const copy = STATUS_COPY[status.status];

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
      <h1 className="font-heading text-xl text-ink">{copy.title}</h1>
      <p className="text-sm text-muted">{copy.description}</p>
      <div className="mt-4 w-full rounded-lg border border-line bg-panel p-4 text-left text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Order number</span>
          <span className="text-ink">{status.orderNumber}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-muted">Total</span>
          <span className="text-ink">{formatCents(status.totalCents, status.currency)}</span>
        </div>
      </div>
      <div className="mt-6">
        <a
          href="/"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink"
        >
          Back to store
        </a>
      </div>
    </div>
  );
}
