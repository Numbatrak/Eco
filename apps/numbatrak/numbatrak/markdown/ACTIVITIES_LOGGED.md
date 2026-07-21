# Activities Logging - What Gets Tracked

## Currently Implemented ✅

The following activities are **currently being logged** in the application:

### Orders
- ✅ **Order Created** - When a new order is created
  - Example: `"Order #123 created for John Doe"`
  - Logged in: `OrdersForm.tsx`

- ✅ **Order Updated** - When an order is modified
  - Example: `"Order #123 updated for John Doe"`
  - Logged in: `OrdersForm.tsx`

- ✅ **Order Deleted** - When an order is removed
  - Example: `"Order #123 deleted (John Doe)"`
  - Logged in: `OrdersForm.tsx`

### Agents
- ✅ **Agent Created** - When a new agent is added
  - Example: `"Agent 'Lagos-3' created"`
  - Logged in: `AgentsForm.tsx`

- ✅ **Agent Updated** - When agent details are modified
  - Example: `"Agent 'Lagos-3' updated"`
  - Logged in: `AgentsForm.tsx`

- ✅ **Agent Deleted** - When an agent is removed
  - Example: `"Agent 'Lagos-3' deleted"`
  - Logged in: `AgentsForm.tsx`

---

## Available But Not Yet Implemented 🔄

The following activity types are **defined in the system** but **not yet being logged**. They can be easily added:

### Deliveries
- ⏳ **Delivery Created** - When a new delivery is created
- ⏳ **Delivery Updated** - When delivery details are modified
- ⏳ **Delivery Deleted** - When a delivery is removed
- 📍 **Location**: `DeliveriesForm.tsx` (needs activity logging added)

### Products
- ⏳ **Product Created** - When a new product is added
- ⏳ **Product Updated** - When product details are modified
- ⏳ **Product Deleted** - When a product is removed
- 📍 **Location**: `ProductsForm.tsx` (needs activity logging added)

### Expenses
- ⏳ **Expense Created** - When a new expense is recorded
- ⏳ **Expense Updated** - When expense details are modified
- ⏳ **Expense Deleted** - When an expense is removed
- 📍 **Location**: `ExpensesForm.tsx` and `GeneralExpensesForm.tsx` (needs activity logging added)

### Inventory
- ⏳ **Inventory Updated** - When inventory levels are changed
- 📍 **Location**: `InventoryForm.tsx` (needs activity logging added)

### Follow-Ups
- ⏳ **Follow-Up Created** - When a new follow-up task is created
- ⏳ **Follow-Up Updated** - When follow-up details are modified
- ⏳ **Follow-Up Completed** - When a follow-up is marked as completed
- 📍 **Location**: `FollowUpsForm.tsx` and `followUps.ts` service (needs activity logging added)

### Abandoned Carts
- ⏳ **Abandoned Cart Converted** - When an abandoned cart is converted to an order
- 📍 **Location**: `abandonedCarts.ts` service (needs activity logging added)

### User Management
- ⏳ **User Invited** - When a user is invited to an organization
- ⏳ **User Role Changed** - When a user's role is updated
- 📍 **Location**: `organizationInvitations.ts` and organization components (needs activity logging added)

### Organizations
- ⏳ **Organization Created** - When a new organization is created
- ⏳ **Organization Updated** - When organization details are modified
- 📍 **Location**: `organizations.ts` service (needs activity logging added)

---

## Activity Information Captured

For each logged activity, the system captures:

1. **Who** - User ID and user name (from `user_profiles`)
2. **What** - Action type (e.g., `order_created`, `agent_updated`)
3. **When** - Timestamp (automatically set)
4. **Where** - Organization ID (scoped to organization)
5. **Which Entity** - Entity type and entity ID (e.g., order #123)
6. **Description** - Human-readable description of the action
7. **Metadata** - Optional JSON data with additional context

---

## Example Activity Log Entries

```json
{
  "id": 1,
  "organization_id": "uuid-here",
  "user_id": "user-uuid",
  "user_name": "John Doe",
  "action_type": "order_created",
  "entity_type": "order",
  "entity_id": 123,
  "description": "Order #123 created for Jane Smith",
  "metadata": null,
  "created_at": "2024-01-15T10:30:00Z"
}
```

```json
{
  "id": 2,
  "organization_id": "uuid-here",
  "user_id": "user-uuid",
  "user_name": "John Doe",
  "action_type": "agent_updated",
  "entity_type": "agent",
  "entity_id": 45,
  "description": "Agent 'Lagos-3' updated",
  "metadata": {
    "changes": ["locations", "name"]
  },
  "created_at": "2024-01-15T11:15:00Z"
}
```

---

## How to Add Activity Logging

To add activity logging to a new component:

1. **Import the hook:**
```typescript
import { useActivityLogger } from "../utils/activityLogger";
```

2. **Use the hook:**
```typescript
const { logActivityAction } = useActivityLogger();
```

3. **Log after successful operations:**
```typescript
// After creating
const newItem = await createItem(data);
await logActivityAction(
  'item_created',
  'item',
  newItem.id,
  `Item "${newItem.name}" created`
);

// After updating
const updatedItem = await updateItem(id, data);
await logActivityAction(
  'item_updated',
  'item',
  updatedItem.id,
  `Item "${updatedItem.name}" updated`
);

// After deleting
await logActivityAction(
  'item_deleted',
  'item',
  itemId,
  `Item "${itemName}" deleted`
);
```

---

## Viewing Activities

- **Who can view**: Only Owners and Admins
- **Where**: Dashboard → Activity Feed (right side)
- **Auto-refresh**: Every 30 seconds
- **Limit**: Shows last 50 activities
- **Display**: Shows description, user name, and relative time (e.g., "2 min ago")

---

## Summary

**Currently Logged**: 6 activity types (Orders: 3, Agents: 3)

**Available to Add**: 20+ additional activity types across:
- Deliveries (3 types)
- Products (3 types)
- Expenses (3 types)
- Inventory (1 type)
- Follow-Ups (3 types)
- Abandoned Carts (1 type)
- User Management (2 types)
- Organizations (2 types)

The system is designed to easily extend activity logging to any component by simply adding a few lines of code after successful operations.

