"use client";

import { useChunk } from "stunk/react";
import { useState, useCallback, useEffect } from "react";
import {
  productsStore,
  getCachedData,
  setStoreData,
  updateStoreItem,
  removeStoreItem,
} from "../stores/dataStore";
import { fetchProducts } from "../services/products";
import type { Product } from "../types/product";

/**
 * Split out of useCachedData.ts - see useCachedAgents.ts's header comment
 * for why (that file statically imports every domain's fetch function,
 * including still-Supabase ones, crashing any already-ported page).
 */
export function useCachedProducts(organizationId: string | null) {
  const [storeData] = useChunk(productsStore);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgData = organizationId ? storeData[organizationId] : null;
  const cachedData = getCachedData(productsStore, organizationId);
  const data = cachedData || orgData?.data || [];
  const loading = isLoading;
  const storeError = orgData?.error || null;

  const loadData = useCallback(
    async (force = false) => {
      if (!organizationId) return;

      const currentCachedData = getCachedData(productsStore, organizationId);
      if (!force && currentCachedData) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const fetchedData = await fetchProducts(organizationId);
        setStoreData(productsStore, organizationId, fetchedData, null);
        setError(null);
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load data";
        setError(errorMessage);
        setStoreData(productsStore, organizationId, [], errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [organizationId]
  );

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return {
    data,
    loading,
    error: error || storeError,
    refetch: () => loadData(true),
    updateItem: (item: Product) => updateStoreItem(productsStore, organizationId, item),
    removeItem: (itemId: number) => removeStoreItem(productsStore, organizationId, itemId),
  };
}
