export interface GeneralExpense {
  id: number;
  date: string; // ISO date string
  product_id: number | null;
  category: string;
  subcategory: string;
  amount: number;
  created_at?: string | null;
}

export interface GeneralExpenseWithRelations extends GeneralExpense {
  product?: {
    id: number;
    name: string;
  } | null;
}













