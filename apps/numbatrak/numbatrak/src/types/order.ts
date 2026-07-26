export interface Order {
  id: number;
  customer_name: string;
  phone_number: string | null;
  location: string | null;
  order_date: string; // ISO date string
  order_month: string | null;
  order_year: string | null;
  product_name: string | null;
  mail_quan: number | null;
  agent_quan: number | null;
  quantity: number | null;
  product2: string | null;
  mail_quan2: number | null;
  agent_quan2: number | null;
  quantity2: number | null;
  cost_price: number | null;
  delivery_fee: number | null;
  sales_price: number | null;
  profit: number | null;
  order_status: string | null; // "Delivered" | "Pending" | "Cancelled"
  delivery_date: string | null;
  delivery_month: string | null;
  delivery_year: string | null;
  confirmed_delivery: boolean;
  agent_name: string | null;
  note: string | null;
  subject: string | null;
  assigned_to?: string | null; // UUID of the CSR user assigned to this order
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OrderWithRelations extends Order {
  // Can add relations here if needed (e.g., agent, product)
}








