# Data Caching with Stunk

This application uses [Stunk](https://www.npmjs.com/package/stunk) for state management to cache data and prevent unnecessary reloads when navigating between pages.

## How It Works

- **Cached Data**: Data is stored in memory with a 5-minute cache duration
- **Automatic Loading**: Data is automatically fetched when a component mounts if not cached or stale
- **Organization-Scoped**: Each organization's data is cached separately
- **Optimistic Updates**: Create/Update/Delete operations update the cache immediately

## Usage

### Using Cached Hooks

Instead of manually fetching data, use the provided hooks:

```tsx
import { useCachedAgents } from "../hooks/useCachedData";

function MyComponent() {
  const { currentOrganization } = useOrganization();
  const { data: agents, loading, error, updateItem, removeItem } = useCachedAgents(
    currentOrganization?.id || null
  );

  // Data is automatically loaded and cached
  // No need to call fetchAgents manually!
}
```

### Available Hooks

- `useCachedAgents(organizationId)` - Cached agents
- `useCachedProducts(organizationId)` - Cached products
- `useCachedDeliveries(organizationId)` - Cached deliveries
- `useCachedOrders(organizationId)` - Cached orders
- `useCachedAbandonedCarts(organizationId)` - Cached abandoned carts
- `useCachedFollowUps(organizationId)` - Cached follow-ups
- `useCachedExpenses(organizationId)` - Cached expenses
- `useCachedGeneralExpenses(organizationId)` - Cached general expenses
- `useCachedInventory(organizationId)` - Cached inventory

### Hook Return Values

Each hook returns:
- `data: T[]` - The cached data array
- `loading: boolean` - Loading state
- `error: string | null` - Error message if any
- `updateItem: (item: T) => void` - Update/add item in cache
- `removeItem: (itemId: number) => void` - Remove item from cache
- `refetch: () => void` - Force reload data (bypasses cache)

### Updating Cache After Mutations

When you create, update, or delete items, update the cache:

```tsx
// Create
const newAgent = await createAgent({ ... });
updateItem(newAgent); // Updates cache immediately

// Update
const updatedAgent = await updateAgent(id, { ... });
updateItem(updatedAgent); // Updates cache immediately

// Delete
await removeAgent(id);
removeItem(id); // Removes from cache immediately
```

## Benefits

1. **No Reloads on Navigation**: Data persists when moving between pages
2. **Faster UI**: Cached data displays instantly
3. **Reduced API Calls**: Data only fetches when stale or missing
4. **Better UX**: No loading spinners on every page visit

## Cache Duration

Data is cached for **5 minutes**. After that, it's considered stale and will be refetched automatically.

## Clearing Cache

To clear all caches (e.g., on logout):

```tsx
import { clearAllCaches } from "../stores/dataStore";

clearAllCaches();
```



