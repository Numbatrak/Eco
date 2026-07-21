export interface AgentExpense {
  id: number;
  date: string; // ISO date string
  category: string;
  amount: number;
  agent_id: number | null;
  created_at?: string | null;
}

export interface AgentExpenseWithRelations extends AgentExpense {
  agent?: {
    id: number;
    name: string;
  } | null;
}













