"use client";

import { useChunk } from "stunk/react";
import { useState, useCallback, useEffect } from "react";
import {
  agentsStore,
  getCachedData,
  setStoreData,
  updateStoreItem,
  removeStoreItem,
} from "../stores/dataStore";
import { fetchAgents, Agent } from "../services/agents";

/**
 * Split out of useCachedData.ts - that file statically imports every
 * domain's fetch function (including still-Supabase ones like
 * services/inventory.ts), which crashes any already-ported page that
 * imports anything from it, since ES module imports execute eagerly
 * regardless of which named export is actually used. Agents/Orders only
 * need this one, so it gets its own file with only ported dependencies.
 */
export function useCachedAgents(organizationId: string | null) {
  const [storeData] = useChunk(agentsStore);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgData = organizationId ? storeData[organizationId] : null;
  const cachedData = getCachedData(agentsStore, organizationId);
  const data = cachedData || orgData?.data || [];
  const loading = isLoading;
  const storeError = orgData?.error || null;

  const loadData = useCallback(
    async (force = false) => {
      if (!organizationId) return;

      const currentCachedData = getCachedData(agentsStore, organizationId);
      if (!force && currentCachedData) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const fetchedData = await fetchAgents(organizationId);
        setStoreData(agentsStore, organizationId, fetchedData, null);
        setError(null);
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load data";
        setError(errorMessage);
        setStoreData(agentsStore, organizationId, [], errorMessage);
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
    updateItem: (item: Agent) => updateStoreItem(agentsStore, organizationId, item),
    removeItem: (itemId: number) => removeStoreItem(agentsStore, organizationId, itemId),
  };
}
