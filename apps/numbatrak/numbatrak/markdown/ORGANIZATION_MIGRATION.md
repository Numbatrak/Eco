# Organization-Based Architecture Migration Guide

This document explains the changes made to convert the Numbatrak application to an organization-based multi-tenant system.

## Overview

The application has been refactored to support multiple organizations. Users can now:
- Join existing organizations or create new ones
- Have different roles in different organizations
- Switch between organizations
- Manage organization members and roles from organization settings

## Database Changes

### New Tables

1. **organizations** - Stores organization information
   - `id` (UUID, primary key)
   - `name` (TEXT)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

2. **organization_members** - Many-to-many relationship between users and organizations
   - `id` (UUID, primary key)
   - `organization_id` (UUID, foreign key to organizations)
   - `user_id` (UUID, foreign key to auth.users)
   - `role` (TEXT: 'Owner', 'Admin', 'Customer Relations', 'Manager')
   - `created_at`, `updated_at` (TIMESTAMPTZ)
   - Unique constraint on (organization_id, user_id)

### Modified Tables

All data tables now include an `organization_id` column:
- `agents`
- `products`
- `deliveries`
- `orders`
- `agent_expenses`
- `general_expenses`
- `inventory`
- `abandoned_carts`
- `follow_ups`

### Row Level Security (RLS) Updates

All RLS policies have been updated to be organization-scoped:
- Users can only see data from organizations they belong to
- Permissions are checked based on the user's role in the specific organization
- New helper functions: `get_user_org_role()`, `is_org_member()`, `has_org_role()`, `has_any_org_role()`

## Application Changes

### New Components

1. **OrganizationContext** (`src/contexts/OrganizationContext.tsx`)
   - Manages current organization state
   - Provides organization switching functionality
   - Persists selected organization in localStorage

2. **OrganizationSelectionPage** (`src/components/organizations/OrganizationSelectionPage.tsx`)
   - Shown after login if user has no organization selected
   - Allows users to select an existing organization or create a new one

3. **OrganizationSettingsPage** (`src/components/organizations/OrganizationSettingsPage.tsx`)
   - Manage organization members
   - Update member roles (Owner/Admin only)
   - Remove members (Owner only)
   - Switch between organizations

### Updated Components

1. **App.tsx**
   - Added OrganizationProvider wrapper
   - Added organization selector in header
   - Redirects to organization selection if no organization is selected

2. **OrdersForm.tsx**
   - Updated to use organization context
   - Filters orders by current organization
   - Includes organization_id when creating orders

3. **Sidebar.tsx**
   - Added link to Organization Settings

### Updated Services

All service functions have been updated to:
- Accept `organizationId` parameter for filtering
- Include `organization_id` when creating new records

Updated services:
- `orders.ts` - `fetchOrders()`, `createOrder()`
- `agents.ts` - `fetchAgents()`, `createAgent()`
- `products.ts` - `fetchProducts()`, `fetchProductsWithPrices()`, `createProduct()`

**Note**: Other services (deliveries, expenses, inventory, etc.) still need to be updated similarly.

### Updated Hooks

1. **usePermissions** (`src/hooks/usePermissions.ts`)
   - Now uses organization role instead of user profile role
   - Permissions are organization-scoped

## Migration Steps

### 1. Run Database Migration

Execute the SQL script in `scripts/setupOrganizations.sql` in your Supabase SQL Editor:

```sql
-- This will:
-- 1. Create organizations and organization_members tables
-- 2. Add organization_id to all data tables
-- 3. Update RLS policies to be organization-scoped
-- 4. Create helper functions for organization-based access
```

### 2. Create Default Organization (Optional)

If you have existing data, you'll need to:

1. Create a default organization:
```sql
INSERT INTO organizations (name) VALUES ('Default Organization') RETURNING id;
```

2. Assign all existing data to this organization:
```sql
UPDATE orders SET organization_id = '<org-id>' WHERE organization_id IS NULL;
UPDATE agents SET organization_id = '<org-id>' WHERE organization_id IS NULL;
-- Repeat for all tables
```

3. Add users to the organization:
```sql
INSERT INTO organization_members (organization_id, user_id, role)
SELECT '<org-id>', id, role FROM user_profiles;
```

### 3. Update Remaining Services

The following services still need to be updated to include organization filtering:

- `src/services/deliveries.ts`
- `src/services/expenses.ts`
- `src/services/generalExpenses.ts`
- `src/services/inventory.ts`
- `src/services/abandonedCarts.ts`
- `src/services/followUps.ts`
- `src/services/dashboard.ts`

Update pattern:
```typescript
// Before
export async function fetchDeliveries(): Promise<DeliveryWithRelations[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*");
  // ...
}

// After
export async function fetchDeliveries(organizationId: string | null): Promise<DeliveryWithRelations[]> {
  let query = supabase
    .from("deliveries")
    .select("*");
  
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }
  
  const { data, error } = await query;
  // ...
}
```

### 4. Update Components Using Services

For each component that uses the updated services:

1. Import `useOrganization` hook
2. Get `currentOrganization` from context
3. Pass `currentOrganization?.id` to service functions
4. Include `organization_id` when creating records

Example:
```typescript
import { useOrganization } from "../contexts/OrganizationContext";

function MyComponent() {
  const { currentOrganization } = useOrganization();
  
  useEffect(() => {
    if (currentOrganization) {
      loadData();
    }
  }, [currentOrganization]);
  
  const loadData = async () => {
    if (!currentOrganization) return;
    const data = await fetchDeliveries(currentOrganization.id);
    // ...
  };
  
  const handleCreate = async () => {
    if (!currentOrganization) return;
    await createDelivery({
      ...deliveryData,
      organization_id: currentOrganization.id,
    });
  };
}
```

## User Flow

### New User Flow

1. User signs up/logs in
2. If user has no organization memberships, they see the Organization Selection page
3. User can either:
   - Create a new organization (becomes Owner)
   - Join an existing organization (if they have an invitation)
4. After selecting/creating an organization, user is redirected to the dashboard
5. User can switch organizations using the selector in the header
6. User can manage organization settings from the Organization Settings page

### Existing User Flow

1. User logs in
2. If user has organization memberships, the first one is selected automatically
3. User can switch organizations using the header selector
4. User can manage organization members and roles from Organization Settings

## Role Management

Roles are now organization-scoped:
- A user can have different roles in different organizations
- Roles are managed per organization in Organization Settings
- Only Owners and Admins can manage member roles
- Only Owners can remove members

## Testing Checklist

- [ ] Run database migration script
- [ ] Create test organizations
- [ ] Test organization selection after login
- [ ] Test creating new organization
- [ ] Test switching between organizations
- [ ] Test organization settings page
- [ ] Test role management (update roles, remove members)
- [ ] Test data isolation (users only see data from their organizations)
- [ ] Test permissions (roles work correctly per organization)
- [ ] Update all remaining services
- [ ] Update all components using those services

## Notes

- The `user_profiles` table still exists but is no longer used for role management
- Roles are now stored in `organization_members` table
- The first user to create an organization automatically becomes Owner
- Organization selection persists in localStorage
- All data queries are filtered by organization_id at the database level via RLS

## Future Enhancements

- Organization invitations system
- Organization deletion (with data migration)
- Organization-level settings (billing, features, etc.)
- Audit logs for organization changes
- Bulk operations for organization management


