"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Cart } from "@platform/shared-types";
import { cartApi } from "../lib/cartApi";
import { ApiError } from "../lib/apiClient";

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  subdomain,
  children,
}: {
  subdomain: string;
  children: ReactNode;
}): React.ReactElement {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const current = await cartApi.getCart(subdomain);
      setCart(current);
    } catch (fetchError) {
      if (fetchError instanceof ApiError && fetchError.status === 404) {
        // No cart cookie yet for this site - create one so add-to-cart works immediately.
        try {
          const created = await cartApi.createCart(subdomain);
          setCart(created);
        } catch {
          setCart(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [subdomain]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (productId: string, quantity = 1) => {
      setError(null);
      try {
        const updated = await cartApi.addItem(subdomain, { productId, quantity });
        setCart(updated);
      } catch (addError) {
        // Cart cookie may have expired or been cleared. Create a fresh cart
        // and retry once so the shopper doesn't see a spurious failure.
        if (addError instanceof ApiError && addError.status === 404) {
          try {
            await cartApi.createCart(subdomain);
            const updated = await cartApi.addItem(subdomain, { productId, quantity });
            setCart(updated);
            return;
          } catch (retryError) {
            setError(
              retryError instanceof ApiError ? retryError.message : "Could not add this item.",
            );
            throw retryError;
          }
        }
        setError(addError instanceof ApiError ? addError.message : "Could not add this item.");
        throw addError;
      }
    },
    [subdomain],
  );

  const updateItemQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      setError(null);
      try {
        const updated = await cartApi.updateItem(subdomain, itemId, { quantity });
        setCart(updated);
      } catch (updateError) {
        setError(updateError instanceof ApiError ? updateError.message : "Could not update this item.");
        throw updateError;
      }
    },
    [subdomain],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      setError(null);
      try {
        const updated = await cartApi.removeItem(subdomain, itemId);
        setCart(updated);
      } catch (removeError) {
        setError(removeError instanceof ApiError ? removeError.message : "Could not remove this item.");
        throw removeError;
      }
    },
    [subdomain],
  );

  return (
    <CartContext.Provider value={{ cart, loading, error, addItem, updateItemQuantity, removeItem, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
