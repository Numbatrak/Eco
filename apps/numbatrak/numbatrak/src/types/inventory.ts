export interface Inventory {
  id: number;
  agent_id: number | null;
  /** `products.id` (UUID) */
  product_id: string;
  total_quantity: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InventoryWithRelations extends Inventory {
  agent?: {
    id: number;
    name: string;
  } | null;
  product?: {
    id: string;
    name: string;
  } | null;
}

export interface InventorySummary {
  agent_id: number | null;
  agent_name: string;
  products: {
    product_id: string;
    product_name: string;
    total: number;
    delivered: number;
    remaining: number;
  }[];
}













