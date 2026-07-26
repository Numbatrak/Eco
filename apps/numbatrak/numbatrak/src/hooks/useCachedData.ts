"use client";

import { useChunk } from "stunk/react";
import { useEffect, useState, useCallback } from "react";
import {
  agentsStore,
  productsStore,
  deliveriesStore,
  ordersStore,
  abandonedCartsStore,
  followUpsStore,
  expensesStore,
  generalExpensesStore,
  inventoryStore,
  getCachedData,
  setStoreData,
  updateStoreItem,
  removeStoreItem,
} from "../stores/dataStore";
import { fetchAgents } from "../services/agents";
import { fetchProducts } from "../services/products";
import { fetchDeliveries } from "../services/deliveries";
import { fetchOrders } from "../services/orders";
import { fetchAbandonedCarts } from "../services/abandonedCarts";
import { fetchFollowUps } from "../services/followUps";
import { fetchExpenses } from "../services/expenses";
import { fetchGeneralExpenses } from "../services/generalExpenses";
import { fetchInventory } from "../services/inventory";

// Generic hook for cached data
function useCachedDataHook<T extends { id: number }>(
  store: ReturnType<typeof import("../stores/dataStore").agentsStore>,
  organizationId: string | null,
  fetchFunction: (orgId: string | null) => Promise<T[]>
) {
  const [storeData] = useChunk(store);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgData = organizationId ? storeData[organizationId] : null;
  const cachedData = getCachedData(store, organizationId);
  const data = cachedData || orgData?.data || [];
  const loading = isLoading;
  const storeError = orgData?.error || null;

  const loadData = useCallback(async (force = false) => {
    if (!organizationId) return;

    // Check cache before fetching
    const currentCachedData = getCachedData(store, organizationId);
    if (!force && currentCachedData) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const fetchedData = await fetchFunction(organizationId);
      setStoreData(store, organizationId, fetchedData, null);
      setError(null);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load data";
      setError(errorMessage);
      setStoreData(store, organizationId, [], errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, store, fetchFunction]);

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
    updateItem: (item: T) => updateStoreItem(store, organizationId, item),
    removeItem: (itemId: number) => removeStoreItem(store, organizationId, itemId),
  };
}

// Specific hooks for each data type
export function useCachedAgents(organizationId: string | null) {
  return useCachedDataHook(agentsStore, organizationId, fetchAgents);
}

export function useCachedProducts(organizationId: string | null) {
  return useCachedDataHook(productsStore, organizationId, fetchProducts);
}

export function useCachedDeliveries(organizationId: string | null) {
  return useCachedDataHook(deliveriesStore, organizationId, fetchDeliveries);
}

export function useCachedOrders(organizationId: string | null) {
  return useCachedDataHook(ordersStore, organizationId, fetchOrders);
}

export function useCachedAbandonedCarts(organizationId: string | null) {
  return useCachedDataHook(abandonedCartsStore, organizationId, (orgId) =>
    fetchAbandonedCarts(orgId, 0, 1000) // Fetch with large limit for caching
  );
}

export function useCachedFollowUps(organizationId: string | null) {
  return useCachedDataHook(followUpsStore, organizationId, (orgId) =>
    fetchFollowUps(orgId, 0, 1000, "desc")
  );
}

export function useCachedExpenses(organizationId: string | null) {
  return useCachedDataHook(expensesStore, organizationId, fetchExpenses);
}

export function useCachedGeneralExpenses(organizationId: string | null) {
  return useCachedDataHook(generalExpensesStore, organizationId, fetchGeneralExpenses);
}

export function useCachedInventory(organizationId: string | null) {
  return useCachedDataHook(inventoryStore, organizationId, fetchInventory);
}

