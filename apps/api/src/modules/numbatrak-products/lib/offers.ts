import { and, eq } from "drizzle-orm";
import { numbatrakProductOffers, type Database } from "@platform/db";
import type { CreateNumbatrakProductOfferRequest, UpdateNumbatrakProductOfferRequest } from "@platform/shared-types";
import type { NumbatrakProductOfferRow } from "./products.js";

export async function createOffer(
  db: Database,
  organizationId: string,
  productId: string,
  input: CreateNumbatrakProductOfferRequest,
): Promise<NumbatrakProductOfferRow> {
  const [row] = await db
    .insert(numbatrakProductOffers)
    .values({
      organizationId,
      productId,
      variantId: input.variantId ?? null,
      offerType: input.offerType,
      label: input.label,
      minQuantity: input.minQuantity ?? 1,
      freeQuantity: input.freeQuantity ?? 0,
      bundleItems: input.bundleItems ?? null,
      price: String(input.price),
      unitCost: String(input.unitCost),
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      displayOrder: input.displayOrder ?? 0,
    })
    .returning();
  if (!row) throw new Error("Failed to create offer");
  return row;
}

export async function updateOffer(
  db: Database,
  organizationId: string,
  offerId: string,
  input: UpdateNumbatrakProductOfferRequest,
): Promise<NumbatrakProductOfferRow | null> {
  const values: Partial<typeof numbatrakProductOffers.$inferInsert> = { updatedAt: new Date() };
  if (input.variantId !== undefined) values.variantId = input.variantId;
  if (input.offerType !== undefined) values.offerType = input.offerType;
  if (input.label !== undefined) values.label = input.label;
  if (input.minQuantity !== undefined) values.minQuantity = input.minQuantity;
  if (input.freeQuantity !== undefined) values.freeQuantity = input.freeQuantity;
  if (input.bundleItems !== undefined) values.bundleItems = input.bundleItems;
  if (input.price !== undefined) values.price = String(input.price);
  if (input.unitCost !== undefined) values.unitCost = String(input.unitCost);
  if (input.active !== undefined) values.active = input.active;
  if (input.startsAt !== undefined) values.startsAt = input.startsAt ? new Date(input.startsAt) : null;
  if (input.endsAt !== undefined) values.endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (input.displayOrder !== undefined) values.displayOrder = input.displayOrder;

  const [row] = await db
    .update(numbatrakProductOffers)
    .set(values)
    .where(and(eq(numbatrakProductOffers.organizationId, organizationId), eq(numbatrakProductOffers.id, offerId)))
    .returning();
  return row ?? null;
}

export async function removeOffer(db: Database, organizationId: string, offerId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakProductOffers)
    .where(and(eq(numbatrakProductOffers.organizationId, organizationId), eq(numbatrakProductOffers.id, offerId)))
    .returning({ id: numbatrakProductOffers.id });
  return result.length > 0;
}
