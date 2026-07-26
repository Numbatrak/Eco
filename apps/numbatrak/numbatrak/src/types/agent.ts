export interface Agent {
  id: number;
  name: string;
  locations: string[];
  active?: boolean;
  /** Org warehouse / HQ — holds stock, does not deliver */
  is_warehouse?: boolean;
  /** When false, excluded from delivery assignment */
  can_deliver?: boolean;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  created_at?: string | null;
}
