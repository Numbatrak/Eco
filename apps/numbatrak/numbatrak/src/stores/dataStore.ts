"use client";

import { chunk } from "stunk";
import type { Agent } from "../services/agents";
import type { Product } from "../types/product";
import type { DeliveryWithRelations } from "../types/delivery";
import type { OrderWithRelations } from "../types/order";
import type { AbandonedCartWithRelations } from "../types/abandonedCart";
import type { FollowUpWithRelations } from "../types/followUp";
import type { AgentExpenseWithRelations } from "../types/expense";
import type { GeneralExpenseWithRelations } from "../types/generalExpense";
import type { InventoryWithRelations } from "../types/inventory";
import type { Staff } from "../types/staff";

// Store structure for each organization
type OrganizationData<T> = {
  data: T[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
};

// Cache duration: 5 minutes (300000 ms)
const CACHE_DURATION = 5 * 60 * 1000;

// Agents store - keyed by organizationId
export const agentsStore = chunk<Record<string, OrganizationData<Agent>>>(
  {} as Record<string, OrganizationData<Agent>>
);

// Products store - keyed by organizationId
export const productsStore = chunk<Record<string, OrganizationData<Product>>>(
  {} as Record<string, OrganizationData<Product>>
);

// Deliveries store - keyed by organizationId
export const deliveriesStore = chunk<
  Record<string, OrganizationData<DeliveryWithRelations>>
>({} as Record<string, OrganizationData<DeliveryWithRelations>>);

// Orders store - keyed by organizationId
export const ordersStore = chunk<
  Record<string, OrganizationData<OrderWithRelations>>
>({} as Record<string, OrganizationData<OrderWithRelations>>);

// Abandoned Carts store - keyed by organizationId
export const abandonedCartsStore = chunk<
  Record<string, OrganizationData<AbandonedCartWithRelations>>
>({} as Record<string, OrganizationData<AbandonedCartWithRelations>>);

// Follow Ups store - keyed by organizationId
export const followUpsStore = chunk<
  Record<string, OrganizationData<FollowUpWithRelations>>
>({} as Record<string, OrganizationData<FollowUpWithRelations>>);

// Expenses store - keyed by organizationId
export const expensesStore = chunk<
  Record<string, OrganizationData<AgentExpenseWithRelations>>
>({} as Record<string, OrganizationData<AgentExpenseWithRelations>>);

// General Expenses store - keyed by organizationId
export const generalExpensesStore = chunk<
  Record<string, OrganizationData<GeneralExpenseWithRelations>>
>({} as Record<string, OrganizationData<GeneralExpenseWithRelations>>);

// Inventory store - keyed by organizationId
export const inventoryStore = chunk<
  Record<string, OrganizationData<InventoryWithRelations>>
>({} as Record<string, OrganizationData<InventoryWithRelations>>);

// Staff store - keyed by organizationId
export const staffStore = chunk<Record<string, OrganizationData<Staff>>>(
  {} as Record<string, OrganizationData<Staff>>
);

// Helper function to check if data is stale
function isStale(lastFetched: number | null): boolean {
  if (!lastFetched) return true;
  return Date.now() - lastFetched > CACHE_DURATION;
}

// Helper function to get cached data or return null if stale/missing
export function getCachedData<T>(
  store: ReturnType<typeof chunk<Record<string, OrganizationData<T>>>>,
  organizationId: string | null
): T[] | null {
  if (!organizationId) return null;

  const orgData = store.get()[organizationId];
  if (!orgData || !orgData.data.length || isStale(orgData.lastFetched)) {
    return null;
  }

  return orgData.data;
}

// Helper function to set data in store
export function setStoreData<T>(
  store: ReturnType<typeof chunk<Record<string, OrganizationData<T>>>>,
  organizationId: string | null,
  data: T[],
  error: string | null = null
): void {
  if (!organizationId) return;

  store.set((prev) => ({
    ...prev,
    [organizationId]: {
      data,
      loading: false,
      error,
      lastFetched: Date.now(),
    },
  }));
}

// Clear all caches (useful for logout)
export function clearAllCaches(): void {
  const reset = <T,>() => ({} as Record<string, OrganizationData<T>>);
  agentsStore.set(reset<Agent>());
  productsStore.set(reset<Product>());
  deliveriesStore.set(reset<DeliveryWithRelations>());
  ordersStore.set(reset<OrderWithRelations>());
  abandonedCartsStore.set(reset<AbandonedCartWithRelations>());
  followUpsStore.set(reset<FollowUpWithRelations>());
  expensesStore.set(reset<AgentExpenseWithRelations>());
  generalExpensesStore.set(reset<GeneralExpenseWithRelations>());
  inventoryStore.set(reset<InventoryWithRelations>());
  staffStore.set(reset<Staff>());
}

// Helper function to add/update a single item in store
export function updateStoreItem<T extends { id: number | string }>(
  store: ReturnType<typeof chunk<Record<string, OrganizationData<T>>>>,
  organizationId: string | null,
  item: T
): void {
  if (!organizationId) return;

  store.set((prev) => {
    const orgData = prev[organizationId] || {
      data: [],
      loading: false,
      error: null,
      lastFetched: null,
    };
    const existingIndex = orgData.data.findIndex((d) => d.id === item.id);

    let newData: T[];
    if (existingIndex >= 0) {
      // Update existing item
      newData = [...orgData.data];
      newData[existingIndex] = item;
    } else {
      // Add new item
      newData = [item, ...orgData.data];
    }

    return {
      ...prev,
      [organizationId]: {
        ...orgData,
        data: newData,
      },
    };
  });
}

// Helper function to remove an item from store
export function removeStoreItem<T extends { id: number }>(
  store: ReturnType<typeof chunk<Record<string, OrganizationData<T>>>>,
  organizationId: string | null,
  itemId: number
): void {
  if (!organizationId) return;

  store.set((prev) => {
    const orgData = prev[organizationId];
    if (!orgData) return prev;

    return {
      ...prev,
      [organizationId]: {
        ...orgData,
        data: orgData.data.filter((d) => d.id !== itemId),
      },
    };
  });
}

// Helper function to invalidate cache for an organization
export function invalidateStoreCache<T>(
  store: ReturnType<typeof chunk<Record<string, OrganizationData<T>>>>,
  organizationId: string | null
): void {
  if (!organizationId) return;

  store.set((prev) => {
    const orgData = prev[organizationId];
    if (!orgData) return prev;

    return {
      ...prev,
      [organizationId]: {
        ...orgData,
        lastFetched: null, // Mark as stale
      },
    };
  });
}
