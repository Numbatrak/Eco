export type UserRole = "Owner" | "Admin" | "Customer Relations" | "Manager";

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  timezone?: string | null;
  role: UserRole;
  email_verified: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface Permission {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface RolePermissions {
  agents: Permission;
  products: Permission;
  deliveries: Permission;
  orders: Permission;
  expenses: Permission;
  generalExpenses: Permission;
  inventory: Permission;
  forms: Permission;
  users: Permission;
  staff: Permission;
  payroll: Permission;
  attendance: Permission;
  strikes: Permission;
}
