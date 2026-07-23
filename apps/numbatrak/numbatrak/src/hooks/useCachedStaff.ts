"use client";

import { useChunk } from "stunk/react";
import { useState, useCallback, useEffect } from "react";
import {
  staffStore,
  getCachedData,
  setStoreData,
  updateStoreItem,
} from "../stores/dataStore";
import { fetchStaff } from "../services/staff";
import type { Staff } from "../types/staff";

/**
 * Its own file, not folded into the poisoned kitchen-sink useCachedData.ts -
 * see useCachedAgents.ts's header comment for why (that file statically
 * imports every domain's fetch function, including still-Supabase ones,
 * crashing any already-ported page that imports anything from it at all).
 */
export function useCachedStaff(organizationId: string | null) {
  const [storeData] = useChunk(staffStore);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgData = organizationId ? storeData[organizationId] : null;
  const cachedData = getCachedData(staffStore, organizationId);
  const data = cachedData || orgData?.data || [];
  const loading = isLoading;
  const storeError = orgData?.error || null;

  const loadData = useCallback(
    async (force = false) => {
      if (!organizationId) return;

      const currentCachedData = getCachedData(staffStore, organizationId);
      if (!force && currentCachedData) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const fetchedData = await fetchStaff(organizationId);
        setStoreData(staffStore, organizationId, fetchedData, null);
        setError(null);
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load data";
        setError(errorMessage);
        setStoreData(staffStore, organizationId, [], errorMessage);
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
    updateItem: (item: Staff) => updateStoreItem(staffStore, organizationId, item),
  };
}
