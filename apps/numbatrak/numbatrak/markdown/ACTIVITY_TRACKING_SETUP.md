# Activity Tracking System - Setup Guide

## Overview

The activity tracking system has been implemented to allow Owners and Admins to monitor all user actions in the application. The system tracks who does what and when, providing a comprehensive audit trail.

## Features

- ✅ **Real-time Activity Feed**: Owners and Admins can view all activities in their organization
- ✅ **Automatic Logging**: Activities are automatically logged when users perform actions
- ✅ **User Attribution**: Each activity shows who performed the action
- ✅ **Organization-Scoped**: Activities are scoped to organizations
- ✅ **Permission-Based Access**: Only Owners and Admins can view activities

## Setup Instructions

### Step 1: Create the Activities Table

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `scripts/createActivitiesTable.sql`
4. Click **Run** to execute the script

This will:
- Create the `activities` table with all necessary fields
- Set up Row Level Security (RLS) policies
- Create indexes for performance
- Create a helper function for user name retrieval

### Step 2: Verify Setup

After running the script, verify that:
- The `activities` table exists in your database
- RLS policies are enabled
- Only Owners and Admins can view activities

## Activity Types Tracked

The system currently tracks the following activities:

### Orders
- `order_created` - When a new order is created
- `order_updated` - When an order is updated
- `order_deleted` - When an order is deleted

### Agents
- `agent_created` - When a new agent is created
- `agent_updated` - When an agent is updated
- `agent_deleted` - When an agent is deleted

### Additional Activities (can be added)
- Delivery activities
- Product activities
- Inventory activities
- Expense activities
- Follow-up activities
- User management activities
- Organization activities

## Using Activity Logging in Code

### In Components

Use the `useActivityLogger` hook to log activities:

```typescript
import { useActivityLogger } from "../utils/activityLogger";

function MyComponent() {
  const { logActivityAction } = useActivityLogger();

  const handleAction = async () => {
    try {
      // Perform your action
      const result = await someService.createSomething(data);
      
      // Log the activity
      await logActivityAction(
        'entity_created',  // ActivityType
        'entity',          // EntityType
        result.id,         // Entity ID
        `Entity "${result.name}" created`,  // Description
        { metadata: 'optional' }  // Optional metadata
      );
    } catch (error) {
      // Handle error
    }
  };
}
```

### Activity Types

Available activity types are defined in `src/types/activity.ts`:
- `order_created`, `order_updated`, `order_deleted`
- `delivery_created`, `delivery_updated`, `delivery_deleted`
- `agent_created`, `agent_updated`, `agent_deleted`
- `product_created`, `product_updated`, `product_deleted`
- And more...

## Viewing Activities

### In the Dashboard

1. Navigate to the Dashboard
2. The Activity Feed is displayed on the right side (for Owners and Admins only)
3. Activities are automatically refreshed every 30 seconds
4. Activities show:
   - Action description
   - User who performed the action
   - Relative time (e.g., "2 min ago", "1 hour ago")
   - Activity type icon

### Activity Feed Features

- **Real-time Updates**: Activities refresh automatically
- **User Attribution**: Shows who performed each action
- **Time Stamps**: Shows relative time for each activity
- **Type Icons**: Visual indicators for different activity types
- **Scrollable**: View up to 50 most recent activities

## Database Schema

### Activities Table

```sql
activities (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

## Security

- **RLS Policies**: Only Owners and Admins can view activities
- **Organization Scoping**: Users can only see activities from their organizations
- **Insert Permissions**: All authenticated users can insert activities (for logging)
- **Delete Permissions**: Only Owners and Admins can delete activities

## Adding Activity Logging to New Features

When adding new features, consider logging:

1. **Create Operations**: Log when new entities are created
2. **Update Operations**: Log when entities are updated
3. **Delete Operations**: Log when entities are deleted
4. **Status Changes**: Log important status changes
5. **User Actions**: Log user management actions

Example:

```typescript
// After creating a delivery
await logActivityAction(
  'delivery_created',
  'delivery',
  newDelivery.id,
  `Delivery created for Order #${orderId}`
);

// After updating a product
await logActivityAction(
  'product_updated',
  'product',
  product.id,
  `Product "${product.name}" updated`,
  { changes: ['price', 'quantity'] }
);
```

## Troubleshooting

### Activities Not Showing

1. **Check Permissions**: Ensure you're logged in as Owner or Admin
2. **Check Organization**: Ensure you have an organization selected
3. **Check Database**: Verify the activities table exists and has data
4. **Check RLS**: Verify RLS policies are correctly set up

### Activities Not Being Logged

1. **Check User Context**: Ensure user and organization are available
2. **Check Errors**: Check browser console for errors
3. **Check Service**: Verify the activity logging service is working
4. **Check Network**: Ensure network requests are completing

## Future Enhancements

Potential improvements:
- Activity filtering by type, user, or date range
- Activity export functionality
- Activity search
- Activity notifications
- Activity analytics
- Activity retention policies

