import { apiRequest } from "../lib/apiClient";
import type { Product } from "../types/product";
import { emptyWithoutOrg } from "./orgQuery";

/**
 * Minimal read-only product list for the Orders line-item picker
 * (ManualOrderDialog). Deliberately separate from `services/products.ts`,
 * which stays fully Supabase-based until Products gets its own port slice -
 * that file is still imported by the not-yet-ported ProductsForm.tsx, and
 * touching it would reintroduce the "imports supabaseClient.ts, throws
 * without Supabase env vars" problem for this (working) Orders page.
 */

interface NumbatrakProductDto {
  id: string;
  name: string;
  sku: string | null;
  active: boolean;
  basePrice: string;
  costPrice: string;
}

export async function fetchProducts(
  organizationId: string | null,
  options?: { activeOnly?: boolean }
): Promise<Product[]> {
  const empty = emptyWithoutOrg<Product>(organizationId);
  if (empty) return empty;

  const { products } = await apiRequest<{ products: NumbatrakProductDto[] }>("/org/numbatrak/products");
  const mapped: Product[] = products.map((p) => ({
    id: p.id,
    organization_id: organizationId!,
    name: p.name,
    sku: p.sku,
    base_price: Number(p.basePrice),
    cost_price: Number(p.costPrice),
    active: p.active,
  }));
  return options?.activeOnly ? mapped.filter((p) => p.active !== false) : mapped;
}
