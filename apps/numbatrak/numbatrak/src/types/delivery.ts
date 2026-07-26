export interface Delivery {
  id: number;
  date: string; // ISO date string
  csr: string | null;
  agent_id: number | null;
  status: "Waybilled" | "Delivered";
  /** `products.id` (UUID in greenfield schemas) */
  product_id: string;
  quantity: number;
  cost: number;
  waybilling_fee: number;
  sub_brand?: string | null;
  waybill_batch_id?: string | null;
  created_at?: string | null;
}

export interface DeliveryWithRelations extends Delivery {
  agent?: {
    id: number;
    name: string;
  } | null;
  product?: {
    id: string;
    name: string;
  } | null;
}













