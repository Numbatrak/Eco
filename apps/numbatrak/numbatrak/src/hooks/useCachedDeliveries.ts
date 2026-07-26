"use client";

import { useChunk } from "stunk/react";
import { useState, useCallback, useEffect } from "react";
import {
  deliveriesStore,
  getCachedData,
  setStoreData,
  updateStoreItem,
  removeStoreItem,
} from "../stores/dataStore";
import { fetchDeliveries } from "../services/deliveries";
import type { DeliveryWithRelations } from "../types/delivery";

/**
 * Split out of useCachedData.ts - see useCachedAgents.ts's header comment
 * for why (that file statically imports every domain's fetch function,
 * including still-Supabase ones, crashing any already-ported page).
 */
export function useCachedDeliveries(organizationId: string | null) {
  const [storeData] = useChunk(deliveriesStore);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgData = organizationId ? storeData[organizationId] : null;
  const cachedData = getCachedData(deliveriesStore, organizationId);
  const data = cachedData || orgData?.data || [];
  const loading = isLoading;
  const storeError = orgData?.error || null;

  const loadData = useCallback(
    async (force = false) => {
      if (!organizationId) return;

      const currentCachedData = getCachedData(deliveriesStore, organizationId);
      if (!force && currentCachedData) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const fetchedData = await fetchDeliveries(organizationId);
        setStoreData(deliveriesStore, organizationId, fetchedData, null);
        setError(null);
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load data";
        setError(errorMessage);
        setStoreData(deliveriesStore, organizationId, [], errorMessage);
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
    updateItem: (item: DeliveryWithRelations) => updateStoreItem(deliveriesStore, organizationId, item),
    removeItem: (itemId: number) => removeStoreItem(deliveriesStore, organizationId, itemId),
  };
}
