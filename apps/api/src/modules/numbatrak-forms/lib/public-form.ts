import { inArray } from "drizzle-orm";
import { numbatrakProducts, type Database } from "@platform/db";

/** Extracts every product_id referenced inside a form's schema JSON
 * (radioOptions[].products[] and radioOptions[].orderBump.products[]) so the
 * public GET endpoint can resolve display names in one round trip - mirrors
 * what embed.js used to do itself via a second direct PostgREST call. */
export function extractProductIdsFromSchema(schema: unknown): string[] {
  const ids = new Set<string>();
  const fields = (schema as { fields?: unknown[] } | null)?.fields;
  if (!Array.isArray(fields)) return [];

  for (const field of fields) {
    const radioOptions = (field as { radioOptions?: unknown[] })?.radioOptions;
    if (Array.isArray(radioOptions)) {
      for (const option of radioOptions) {
        collectFromOption(option, ids);
      }
    }
    const orderBump = (field as { orderBump?: unknown })?.orderBump;
    if (orderBump) collectFromOption(orderBump, ids);
  }
  return [...ids];
}

function collectFromOption(option: unknown, ids: Set<string>): void {
  const products = (option as { products?: unknown[] })?.products;
  if (!Array.isArray(products)) return;
  for (const p of products) {
    const productId = (p as { product_id?: unknown })?.product_id;
    if (typeof productId === "string") ids.add(productId);
  }
}

export async function fetchProductNames(db: Database, organizationId: string, productIds: string[]): Promise<Array<{ id: string; name: string }>> {
  if (productIds.length === 0) return [];
  return db
    .select({ id: numbatrakProducts.id, name: numbatrakProducts.name })
    .from(numbatrakProducts)
    .where(inArray(numbatrakProducts.id, productIds))
    .then((rows) => rows.filter((r) => r.id));
}
