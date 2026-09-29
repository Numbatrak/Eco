export interface Organization {
  id: string;
  name: string;
  logo_url?: string | null;
  timezone?: string | null;
  currency?: string | null;
  /** Business contact phone - org-wide, distinct from any individual user's own profile phone. */
  business_phone?: string | null;
  /** Business WhatsApp number for customer notifications - org-wide, distinct from any individual user's profile. */
  business_whatsapp?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: "Owner" | "Admin" | "Customer Relations" | "Manager";
  created_at: string | null;
  updated_at: string | null;
  user?: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url?: string | null;
  };
}

export interface OrganizationWithRole extends Organization {
  role: "Owner" | "Admin" | "Customer Relations" | "Manager";
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: "Owner" | "Admin" | "Customer Relations" | "Manager";
  invited_by: string;
  status: "pending" | "accepted" | "canceled" | "rejected";
  expires_at: string | null;
  created_at: string | null;
  organization?: {
    id: string;
    name: string;
  };
  invited_by_user?: {
    id: string;
    email: string | null;
    full_name: string | null;
  };
}

