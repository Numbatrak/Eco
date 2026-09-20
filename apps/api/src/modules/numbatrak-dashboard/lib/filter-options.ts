import { and, eq, isNotNull } from "drizzle-orm";
import { numbatrakCustomerOrders, type Database } from "@platform/db";
import type { NumbatrakDashboardFilterOptions } from "@platform/shared-types";

/** Distinct funnel/sub-brand values from numbatrak_customer_orders only -
 * these only exist as first-class columns on customer_orders/form_responses/
 * abandoned_carts, and Dashboard's filter dropdown only needs to cover what
 * live orders actually use, matching the no-form_responses-merge precedent. */
export async function fetchFilterOptions(db: Database, organizationId: string): Promise<NumbatrakDashboardFilterOptions> {
  const funnelRows = await db
    .selectDistinct({ funnelName: numbatrakCustomerOrders.funnelName })
    .from(numbatrakCustomerOrders)
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), isNotNull(numbatrakCustomerOrders.funnelName)));

  const subBrandRows = await db
    .selectDistinct({ subBrand: numbatrakCustomerOrders.subBrand })
    .from(numbatrakCustomerOrders)
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), isNotNull(numbatrakCustomerOrders.subBrand)));

  const offerRows = await db
    .selectDistinct({ offerName: numbatrakCustomerOrders.offerName })
    .from(numbatrakCustomerOrders)
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), isNotNull(numbatrakCustomerOrders.offerName)));

  const funnelNames = [...new Set(funnelRows.map((r) => r.funnelName?.trim()).filter((v): v is string => !!v))].sort();
  const subBrands = [...new Set(subBrandRows.map((r) => r.subBrand?.trim()).filter((v): v is string => !!v))].sort();
  const offerNames = [...new Set(offerRows.map((r) => r.offerName?.trim()).filter((v): v is string => !!v))].sort();

  return { funnelNames, subBrands, offerNames };
}
