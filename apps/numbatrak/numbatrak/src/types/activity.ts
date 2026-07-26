export type ActivityType = 
  | 'order_created' 
  | 'order_updated' 
  | 'order_deleted'
  | 'delivery_created'
  | 'delivery_updated'
  | 'delivery_deleted'
  | 'agent_created'
  | 'agent_updated'
  | 'agent_deleted'
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'inventory_updated'
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'follow_up_created'
  | 'follow_up_updated'
  | 'follow_up_completed'
  | 'abandoned_cart_converted'
  | 'user_invited'
  | 'user_role_changed'
  | 'organization_created'
  | 'organization_updated';

export type EntityType = 
  | 'order' 
  | 'delivery' 
  | 'agent' 
  | 'product' 
  | 'inventory' 
  | 'expense' 
  | 'general_expense'
  | 'follow_up' 
  | 'abandoned_cart' 
  | 'user' 
  | 'organization';

export interface Activity {
  id: number;
  organization_id: string;
  user_id: string;
  user_name: string | null;
  action_type: ActivityType;
  entity_type: EntityType;
  entity_id: number | null;
  description: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface ActivityWithUser extends Activity {
  user?: {
    id: string;
    email: string | null;
    full_name: string | null;
  };
}

