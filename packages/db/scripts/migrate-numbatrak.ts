/**
 * Numbatrak Phase 1 data migration.
 *
 * Copies every "current path" business table (see packages/db/src/schema/numbatrak/
 * for exactly which source tables these are and why) from the live Numbatrak
 * Supabase Postgres instance into this monorepo's Postgres database, in FK
 * dependency order.
 *
 * Run: pnpm --filter @platform/db migrate:numbatrak [--dry-run]
 *
 * Required env (see .env.example):
 *   SOURCE_DATABASE_URL  - Numbatrak's Supabase Postgres connection string.
 *                          Opened READ-ONLY (see openSourceReadOnly below) -
 *                          this script must never be able to write to it.
 *   DATABASE_URL         - this monorepo's target Postgres (used by
 *                          @platform/db's getDb() already).
 *
 * Optional env:
 *   ORG_ID_MAP_PATH   - path to a JSON file { "<old numbatrak org uuid>": "<new organization.id>" }.
 *   USER_ID_MAP_PATH  - path to a JSON file { "<old supabase auth.users uuid>": "<new user.id>" }.
 *   Both default to identity (old id used as-is) when unset - see the big
 *   comment block below for why this is almost certainly wrong for USER_ID_MAP
 *   and needs a real decision from the auth-migration phase.
 *
 * Safety:
 *   - Refuses to run if SOURCE_DATABASE_URL === DATABASE_URL.
 *   - Opens the source connection with `default_transaction_read_only = on`
 *     for the whole session, so any accidental write anywhere in this script
 *     (now or in a future edit) fails loudly at the database level rather
 *     than silently succeeding against production.
 *   - --dry-run fetches and validates every row (including FK resolution
 *     against the target DB) but performs zero writes to the target either -
 *     use this repeatedly against a staging copy first.
 *   - Every insert uses onConflictDoNothing() keyed on the preserved primary
 *     key, so a partial or repeated run is always safe to re-run.
 *
 * ---------------------------------------------------------------------------
 * OPEN CROSS-PHASE QUESTIONS (also called out in MIGRATION_REPORT.md):
 *
 * 1. Organization id mapping. This task's target schema points every
 *    organization_id column at the existing `organization.id` (text, no
 *    format constraint) and assumes a 1:1 row already exists there for every
 *    Numbatrak org before this script runs (that row's creation is the auth
 *    migration phase's job, not this one). If that phase preserves the
 *    original Supabase org uuid as the new `organization.id` value, the
 *    default identity mapping here is correct out of the box. If it instead
 *    generates a fresh id, you MUST supply ORG_ID_MAP_PATH - a row whose
 *    mapped id isn't found in the target `organization` table is skipped
 *    (never partially inserted) and counted in the summary.
 *
 * 2. User id mapping. Same shape of problem for every "who did this" column
 *    (csrId, assignedTo, recordedByUserId, createdBy, remittedBy, userId,
 *    lastAssignedUserId) - these all point at `user.id`. Unlike organization_id,
 *    several of these columns are nullable in the target schema (they were
 *    nullable in the source too), so an unresolvable user reference is NULLed
 *    out and counted rather than blocking the row - except numbatrak_activities.userId
 *    and numbatrak_csr_name_aliases.userId, which are NOT NULL; a row whose
 *    user can't be resolved there is skipped and counted.
 * ---------------------------------------------------------------------------
 */
import { existsSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { getDb } from "../src/client.js";
import { schema } from "../src/schema.js";

const DRY_RUN = process.argv.includes("--dry-run");

const SOURCE_DATABASE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_DATABASE_URL = process.env.DATABASE_URL;

if (!SOURCE_DATABASE_URL) {
  throw new Error("SOURCE_DATABASE_URL is not set - point it at the Numbatrak Supabase Postgres connection string.");
}
if (!TARGET_DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
}
if (SOURCE_DATABASE_URL === TARGET_DATABASE_URL) {
  throw new Error("SOURCE_DATABASE_URL and DATABASE_URL are identical - refusing to run.");
}

function loadIdMap(envVar: string): Map<string, string> {
  const path = process.env[envVar];
  if (!path) return new Map();
  if (!existsSync(path)) throw new Error(`${envVar} points at a file that does not exist: ${path}`);
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  return new Map(Object.entries(raw));
}

const orgIdMap = loadIdMap("ORG_ID_MAP_PATH");
const userIdMap = loadIdMap("USER_ID_MAP_PATH");

function mapOrgId(oldId: string): string {
  return orgIdMap.get(oldId) ?? oldId;
}
function mapUserId(oldId: string): string {
  return userIdMap.get(oldId) ?? oldId;
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

const source = postgres(SOURCE_DATABASE_URL, { max: 1, prepare: false });
const db = getDb();

async function openSourceReadOnly(): Promise<void> {
  // NOTE: deliberately not "tested" with a real write attempt here - even a
  // DDL probe meant to prove the block works would itself be the exact kind
  // of write against production this script must never issue if the guard
  // ever turned out not to hold. `default_transaction_read_only` is a
  // documented, session-wide Postgres GUC (blocks INSERT/UPDATE/DELETE/
  // TRUNCATE and DDL on ordinary tables for every statement on this
  // connection from here on); confirming it was applied via a plain SELECT
  // is enough, combined with the fact that this script issues no other
  // statement against `source` anywhere except SELECT.
  await source`SET default_transaction_read_only = on`;
  const rows = await source<{ read_only: string }[]>`SELECT current_setting('default_transaction_read_only') AS read_only`;
  const readOnly = rows[0]?.read_only;
  if (readOnly !== "on") {
    throw new Error(`Failed to enable read-only mode on source connection (got '${readOnly}') - aborting.`);
  }
  console.log("Source connection confirmed read-only.");
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

interface TableDiag {
  fetched: number;
  inserted: number;
  skippedNoOrg: number;
  skippedOtherRequiredFk: Record<string, number>;
  nulledOptionalFk: Record<string, number>;
}

function newDiag(): TableDiag {
  return { fetched: 0, inserted: 0, skippedNoOrg: 0, skippedOtherRequiredFk: {}, nulledOptionalFk: {} };
}

const diagnostics = new Map<string, TableDiag>();

function bump(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Target reference sets - populated once, then incrementally as each stage's
// rows are inserted, so later stages can validate their own FKs in-process.
// ---------------------------------------------------------------------------

const targetOrgIds = new Set<string>();
const targetUserIds = new Set<string>();
const insertedAgentIds = new Set<number>();
const insertedProductIds = new Set<string>();
const insertedProductVariantIds = new Set<string>();
const insertedProductOfferIds = new Set<string>();
const insertedFormIds = new Set<string>();
const insertedFormResponseIds = new Set<string>();
const insertedFormResponseItemIds = new Set<string>();
const insertedCustomerOrderIds = new Set<string>();
const insertedInventoryLotIds = new Set<string>();
const insertedAbandonedCartIds = new Set<string>();
const insertedUnifiedExpenseIds = new Set<string>();

async function loadTargetReferenceSets(): Promise<void> {
  const orgs = await db.select({ id: schema.organization.id }).from(schema.organization);
  orgs.forEach((r) => targetOrgIds.add(r.id));

  const users = await db.select({ id: schema.user.id }).from(schema.user);
  users.forEach((r) => targetUserIds.add(r.id));
}

// ---------------------------------------------------------------------------
// Generic fetch (keyset pagination on the primary key) + batch insert
// ---------------------------------------------------------------------------

const BATCH_SIZE = 1000;

async function* fetchAllRows(sourceTable: string, pkColumn: string): AsyncGenerator<Record<string, unknown>[]> {
  let lastId: string | number | null = null;
  for (;;) {
    const rows = lastId === null
      ? await source.unsafe(`SELECT * FROM public.${sourceTable} ORDER BY ${pkColumn} ASC LIMIT ${BATCH_SIZE}`)
      : await source.unsafe(
          `SELECT * FROM public.${sourceTable} WHERE ${pkColumn} > $1 ORDER BY ${pkColumn} ASC LIMIT ${BATCH_SIZE}`,
          [lastId],
        );
    if (rows.length === 0) return;
    yield rows as unknown as Record<string, unknown>[];
    lastId = (rows[rows.length - 1] as Record<string, unknown>)[pkColumn] as string | number;
  }
}

async function insertBatch(target: Parameters<typeof db.insert>[0], rows: Record<string, unknown>[]): Promise<number> {
  if (rows.length === 0) return 0;
  if (DRY_RUN) return rows.length;
  // .returning() only reflects rows actually written - conflicts are silently
  // dropped by onConflictDoNothing(), so (rows.length - returned.length) is
  // exactly the "already migrated, skipped" count for this batch. Every
  // numbatrak table's PK column is named `id` - cast is safe here.
  const idColumn = (target as unknown as { id: unknown }).id;
  const returned = await db.insert(target).values(rows as never).onConflictDoNothing().returning({ id: idColumn as never });
  return returned.length;
}

interface MigrationConfig {
  label: string;
  sourceTable: string;
  pkColumn: string;
  target: Parameters<typeof db.insert>[0];
  // Returns the row to insert, or undefined to skip it (already counted by the mapper).
  mapRow: (row: Record<string, unknown>, diag: TableDiag) => Record<string, unknown> | undefined;
  // Runs once per row that was actually inserted (in-order), to populate the
  // in-memory reference sets later stages depend on.
  afterInsert?: (row: Record<string, unknown>) => void;
}

async function runMigration(config: MigrationConfig): Promise<void> {
  const diag = newDiag();
  diagnostics.set(config.label, diag);

  for await (const rawRows of fetchAllRows(config.sourceTable, config.pkColumn)) {
    diag.fetched += rawRows.length;
    const mapped: Record<string, unknown>[] = [];
    const mappedSourceRows: Record<string, unknown>[] = [];
    for (const row of rawRows) {
      const result = config.mapRow(row, diag);
      if (result === undefined) continue;
      mapped.push(result);
      mappedSourceRows.push(row);
    }
    const insertedCount = await insertBatch(config.target, mapped);
    diag.inserted += insertedCount;
    if (config.afterInsert && !DRY_RUN) {
      // onConflictDoNothing() means some of `mapped` may not have actually
      // landed; afterInsert only needs the id to exist in target, which is
      // true whether this run or a prior run inserted it, so it's safe to
      // call for every mapped row here.
      for (const row of mappedSourceRows) config.afterInsert(row);
    } else if (config.afterInsert && DRY_RUN) {
      for (const row of mappedSourceRows) config.afterInsert(row);
    }
  }
  console.log(
    `${config.label}: fetched=${diag.fetched} inserted=${diag.inserted} skippedNoOrg=${diag.skippedNoOrg} ` +
      `skippedOtherFk=${JSON.stringify(diag.skippedOtherRequiredFk)} nulledOptionalFk=${JSON.stringify(diag.nulledOptionalFk)}`,
  );
}

// ---------------------------------------------------------------------------
// Shared FK-resolution helpers
// ---------------------------------------------------------------------------

function requireOrg(row: Record<string, unknown>, diag: TableDiag): string | undefined {
  const oldId = row.organization_id as string | null;
  if (!oldId) {
    diag.skippedNoOrg++;
    return undefined;
  }
  const mapped = mapOrgId(oldId);
  if (!targetOrgIds.has(mapped)) {
    diag.skippedNoOrg++;
    return undefined;
  }
  return mapped;
}

function optionalUser(oldId: unknown, diag: TableDiag, label: string): string | null {
  if (!oldId || typeof oldId !== "string") return null;
  const mapped = mapUserId(oldId);
  if (!targetUserIds.has(mapped)) {
    bump(diag.nulledOptionalFk, label);
    return null;
  }
  return mapped;
}

function requireUser(oldId: unknown, diag: TableDiag, label: string): string | undefined {
  if (!oldId || typeof oldId !== "string") {
    bump(diag.skippedOtherRequiredFk, label);
    return undefined;
  }
  const mapped = mapUserId(oldId);
  if (!targetUserIds.has(mapped)) {
    bump(diag.skippedOtherRequiredFk, label);
    return undefined;
  }
  return mapped;
}

function optionalRef<T>(oldId: unknown, set: Set<T>, diag: TableDiag, label: string): T | null {
  if (oldId === null || oldId === undefined) return null;
  const value = oldId as T;
  if (!set.has(value)) {
    bump(diag.nulledOptionalFk, label);
    return null;
  }
  return value;
}

function requireRef<T>(oldId: unknown, set: Set<T>, diag: TableDiag, label: string): T | undefined {
  if (oldId === null || oldId === undefined || !set.has(oldId as T)) {
    bump(diag.skippedOtherRequiredFk, label);
    return undefined;
  }
  return oldId as T;
}

// ---------------------------------------------------------------------------
// Ordered migration stages - see packages/db/src/schema/numbatrak/*.ts headers
// for source-table provenance and anomaly notes on individual columns.
// ---------------------------------------------------------------------------

async function migrateAgents(): Promise<void> {
  await runMigration({
    label: "numbatrak_agents",
    sourceTable: "agents",
    pkColumn: "id",
    target: schema.numbatrakAgents,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        name: row.name,
        locations: row.locations,
        state: row.state,
        active: row.active,
        isWarehouse: row.is_warehouse,
        canDeliver: row.can_deliver,
        contactPerson: row.contact_person,
        contactPhone: row.contact_phone,
        contactEmail: row.contact_email,
        createdAt: row.created_at,
      };
    },
    afterInsert: (row) => insertedAgentIds.add(row.id as number),
  });
}

async function migrateCsrNameAliases(): Promise<void> {
  await runMigration({
    label: "numbatrak_csr_name_aliases",
    sourceTable: "csr_name_aliases",
    pkColumn: "id",
    target: schema.numbatrakCsrNameAliases,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      const userId = requireUser(row.user_id, diag, "user_id");
      if (!userId) return undefined;
      return { id: row.id, organizationId, matchPattern: row.match_pattern, userId };
    },
  });
}

async function migrateProducts(): Promise<void> {
  await runMigration({
    label: "numbatrak_products",
    sourceTable: "products",
    pkColumn: "id",
    target: schema.numbatrakProducts,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        name: row.name,
        sku: row.sku,
        type: row.type,
        basePrice: row.base_price,
        costPrice: row.cost_price,
        active: row.active,
        category: row.category,
        subBrand: row.sub_brand,
        allowsVariants: row.allows_variants,
        allowsBundles: row.allows_bundles,
        allowsDiscounts: row.allows_discounts,
        lowStockThreshold: row.low_stock_threshold,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    afterInsert: (row) => insertedProductIds.add(row.id as string),
  });
}

async function migrateProductVariants(): Promise<void> {
  await runMigration({
    label: "numbatrak_product_variants",
    sourceTable: "product_variants",
    pkColumn: "id",
    target: schema.numbatrakProductVariants,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      const productId = requireRef(row.product_id, insertedProductIds, diag, "product_id");
      if (!productId) return undefined;
      return {
        id: row.id,
        organizationId,
        productId,
        name: row.name,
        sku: row.sku,
        basePrice: row.base_price,
        costPrice: row.cost_price,
        active: row.active,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    afterInsert: (row) => insertedProductVariantIds.add(row.id as string),
  });
}

async function migrateProductOffers(): Promise<void> {
  await runMigration({
    label: "numbatrak_product_offers",
    sourceTable: "product_offers",
    pkColumn: "id",
    target: schema.numbatrakProductOffers,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      const productId = requireRef(row.product_id, insertedProductIds, diag, "product_id");
      if (!productId) return undefined;
      return {
        id: row.id,
        organizationId,
        productId,
        variantId: optionalRef(row.variant_id, insertedProductVariantIds, diag, "variant_id"),
        offerType: row.offer_type,
        label: row.label,
        minQuantity: row.min_quantity,
        freeQuantity: row.free_quantity,
        bundleItems: row.bundle_items,
        price: row.price,
        unitCost: row.unit_cost,
        active: row.active,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    afterInsert: (row) => insertedProductOfferIds.add(row.id as string),
  });
}

async function migrateProductPriceHistory(): Promise<void> {
  await runMigration({
    label: "numbatrak_product_price_history",
    sourceTable: "product_price_history",
    pkColumn: "id",
    target: schema.numbatrakProductPriceHistory,
    mapRow: (row, diag) => {
      const productId = requireRef(row.product_id, insertedProductIds, diag, "product_id");
      if (!productId) return undefined;
      return {
        id: row.id,
        productId,
        price: row.price,
        costPrice: row.cost_price,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        createdAt: row.created_at,
      };
    },
  });
}

async function migrateForms(): Promise<void> {
  await runMigration({
    label: "numbatrak_forms",
    sourceTable: "forms",
    pkColumn: "id",
    target: schema.numbatrakForms,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        name: row.name,
        formToken: row.form_token,
        schema: row.schema,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        siteUrl: row.site_url,
        fieldMapping: row.field_mapping,
        subBrand: row.sub_brand,
        funnelName: row.funnel_name,
      };
    },
    afterInsert: (row) => insertedFormIds.add(row.id as string),
  });
}

async function migrateFormProducts(): Promise<void> {
  await runMigration({
    label: "numbatrak_form_products",
    sourceTable: "form_products",
    pkColumn: "id",
    target: schema.numbatrakFormProducts,
    mapRow: (row, diag) => {
      const formId = requireRef(row.form_id, insertedFormIds, diag, "form_id");
      if (!formId) return undefined;
      const productId = requireRef(row.product_id, insertedProductIds, diag, "product_id");
      if (!productId) return undefined;
      return {
        id: row.id,
        formId,
        productId,
        minQuantity: row.min_quantity,
        maxQuantity: row.max_quantity,
        required: row.required,
        pricingMode: row.pricing_mode,
        displayOrder: row.display_order,
        createdAt: row.created_at,
      };
    },
  });
}

async function migrateFormResponses(): Promise<void> {
  // Two-pass for the self-referencing convertedResponseId FK: insert every
  // row with it nulled out, then a second pass patches it in once every row
  // exists. Safe to re-run - the UPDATE is a no-op once already applied.
  await runMigration({
    label: "numbatrak_form_responses",
    sourceTable: "form_responses",
    pkColumn: "id",
    target: schema.numbatrakFormResponses,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        formId: optionalRef(row.form_id, insertedFormIds, diag, "form_id"),
        responseType: row.response_type,
        status: row.status,
        source: row.source,
        pageUrl: row.page_url,
        fieldValues: row.field_values,
        selectedProducts: row.selected_products,
        phoneNumber: row.phone_number,
        packageName: row.package_name,
        customerName: row.customer_name,
        profit: row.profit,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        convertedFromAbandoned: row.converted_from_abandoned,
        convertedResponseId: null, // patched in migrateFormResponseSelfRefs()
        rawPayload: row.raw_payload,
        normalizedPayload: row.normalized_payload,
        items: row.items,
        package: row.package,
        offerName: row.offer_name,
        submittedAt: row.submitted_at,
        submissionStatus: row.submission_status,
        orderCost: row.order_cost,
        orderRevenue: row.order_revenue,
        orderProfit: row.order_profit,
        notes: row.notes,
        deliveryFee: row.delivery_fee,
        amountPaid: row.amount_paid,
        // ANOMALY: source column is uuid but app code treats it as numeric -
        // copied through verbatim; see orders.ts header. Not cross-checked
        // against numbatrak_agents (no FK exists in source either).
        agentId: row.agent_id,
        csrId: optionalUser(row.csr_id, diag, "csr_id"),
        paymentMethod: row.payment_method,
        walletStatus: row.wallet_status,
        remittanceConfirmedAt: row.remittance_confirmed_at,
        remittanceConfirmedBy: optionalUser(row.remittance_confirmed_by, diag, "remittance_confirmed_by"),
        releasedAt: row.released_at,
        releasedBy: optionalUser(row.released_by, diag, "released_by"),
        funnelName: row.funnel_name,
        subBrand: row.sub_brand,
        moneyReceivedBy: row.money_received_by,
      };
    },
    afterInsert: (row) => insertedFormResponseIds.add(row.id as string),
  });
}

async function migrateFormResponseSelfRefs(): Promise<void> {
  if (DRY_RUN) return;
  let patched = 0;
  for await (const rows of fetchAllRows("form_responses", "id")) {
    for (const row of rows) {
      const oldConverted = row.converted_response_id as string | null;
      if (!oldConverted || !insertedFormResponseIds.has(oldConverted)) continue;
      if (!insertedFormResponseIds.has(row.id as string)) continue;
      await db
        .update(schema.numbatrakFormResponses)
        .set({ convertedResponseId: oldConverted })
        .where(eq(schema.numbatrakFormResponses.id, row.id as string));
      patched++;
    }
  }
  console.log(`numbatrak_form_responses: patched ${patched} converted_response_id self-references`);
}

async function migrateFormResponseItems(): Promise<void> {
  await runMigration({
    label: "numbatrak_form_response_items",
    sourceTable: "form_response_items",
    pkColumn: "id",
    target: schema.numbatrakFormResponseItems,
    mapRow: (row, diag) => {
      const formResponseId = requireRef(row.form_response_id, insertedFormResponseIds, diag, "form_response_id");
      if (!formResponseId) return undefined;
      const productId = requireRef(row.product_id, insertedProductIds, diag, "product_id");
      if (!productId) return undefined;
      return {
        id: row.id,
        formResponseId,
        productId,
        quantity: row.quantity,
        unitPriceAtSubmission: row.unit_price_at_submission,
        unitCostAtSubmission: row.unit_cost_at_submission,
        totalPrice: row.total_price,
        totalCost: row.total_cost,
        profit: row.profit,
        createdAt: row.created_at,
        variantId: optionalRef(row.variant_id, insertedProductVariantIds, diag, "variant_id"),
        offerId: optionalRef(row.offer_id, insertedProductOfferIds, diag, "offer_id"),
        quantityPaid: row.quantity_paid,
        freeQuantity: row.free_quantity,
        trueUnitCount: row.true_unit_count,
      };
    },
    afterInsert: (row) => insertedFormResponseItemIds.add(row.id as string),
  });
}

async function migrateInventoryLots(): Promise<void> {
  await runMigration({
    label: "numbatrak_inventory_lots",
    sourceTable: "inventory_lots",
    pkColumn: "id",
    target: schema.numbatrakInventoryLots,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      const productId = requireRef(row.product_id, insertedProductIds, diag, "product_id");
      if (!productId) return undefined;
      return {
        id: row.id,
        organizationId,
        productId,
        quantityRemaining: row.quantity_remaining,
        unitCost: row.unit_cost,
        receivedAt: row.received_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        variantId: optionalRef(row.variant_id, insertedProductVariantIds, diag, "variant_id"),
      };
    },
    afterInsert: (row) => insertedInventoryLotIds.add(row.id as string),
  });
}

async function migrateCustomerOrders(): Promise<void> {
  await runMigration({
    label: "numbatrak_customer_orders",
    sourceTable: "customer_orders",
    pkColumn: "id",
    target: schema.numbatrakCustomerOrders,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        formResponseId: optionalRef(row.form_response_id, insertedFormResponseIds, diag, "form_response_id"),
        formId: optionalRef(row.form_id, insertedFormIds, diag, "form_id"),
        csrId: optionalUser(row.csr_id, diag, "csr_id"),
        agentId: optionalRef(row.agent_id, insertedAgentIds, diag, "agent_id"),
        status: row.status,
        source: row.source,
        customerName: row.customer_name,
        phoneNumber: row.phone_number,
        state: row.state,
        deliveryAddress: row.delivery_address,
        orderRevenue: row.order_revenue,
        orderCost: row.order_cost,
        amountPaid: row.amount_paid,
        deliveryFee: row.delivery_fee,
        profit: row.profit,
        notes: row.notes,
        // Soft reference (no FK in source or target) - copied through as-is.
        abandonedCartId: row.abandoned_cart_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        paymentMethod: row.payment_method,
        walletStatus: row.wallet_status,
        remittanceConfirmedAt: row.remittance_confirmed_at,
        remittanceConfirmedBy: optionalUser(row.remittance_confirmed_by, diag, "remittance_confirmed_by"),
        releasedAt: row.released_at,
        releasedBy: optionalUser(row.released_by, diag, "released_by"),
        offerName: row.offer_name,
        funnelName: row.funnel_name,
        subBrand: row.sub_brand,
        moneyReceivedBy: row.money_received_by,
      };
    },
    afterInsert: (row) => insertedCustomerOrderIds.add(row.id as string),
  });
}

async function migrateCustomerOrderItems(): Promise<void> {
  await runMigration({
    label: "numbatrak_customer_order_items",
    sourceTable: "customer_order_items",
    pkColumn: "id",
    target: schema.numbatrakCustomerOrderItems,
    mapRow: (row, diag) => {
      const orderId = requireRef(row.order_id, insertedCustomerOrderIds, diag, "order_id");
      if (!orderId) return undefined;
      const productId = requireRef(row.product_id, insertedProductIds, diag, "product_id");
      if (!productId) return undefined;
      return {
        id: row.id,
        orderId,
        productId,
        quantity: row.quantity,
        unitPriceAtSubmission: row.unit_price_at_submission,
        unitCostAtSubmission: row.unit_cost_at_submission,
        totalPrice: row.total_price,
        totalCost: row.total_cost,
        profit: row.profit,
        createdAt: row.created_at,
        variantId: optionalRef(row.variant_id, insertedProductVariantIds, diag, "variant_id"),
        offerId: optionalRef(row.offer_id, insertedProductOfferIds, diag, "offer_id"),
        quantityPaid: row.quantity_paid,
        freeQuantity: row.free_quantity,
        trueUnitCount: row.true_unit_count,
      };
    },
  });
}

async function migrateOrderInventoryConsumption(): Promise<void> {
  await runMigration({
    label: "numbatrak_order_inventory_consumption",
    sourceTable: "order_inventory_consumption",
    pkColumn: "id",
    target: schema.numbatrakOrderInventoryConsumption,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      // Source FK targets form_responses, not customer_orders - see orders.ts.
      const orderId = requireRef(row.order_id, insertedFormResponseIds, diag, "order_id (form_responses)");
      if (!orderId) return undefined;
      const orderItemId = requireRef(row.order_item_id, insertedFormResponseItemIds, diag, "order_item_id");
      if (!orderItemId) return undefined;
      const inventoryLotId = requireRef(row.inventory_lot_id, insertedInventoryLotIds, diag, "inventory_lot_id");
      if (!inventoryLotId) return undefined;
      return {
        id: row.id,
        organizationId,
        orderId,
        orderItemId,
        inventoryLotId,
        quantityConsumed: row.quantity_consumed,
        unitCost: row.unit_cost,
        createdAt: row.created_at,
      };
    },
  });
}

async function migrateStockMovements(): Promise<void> {
  await runMigration({
    label: "numbatrak_stock_movements",
    sourceTable: "stock_movements",
    pkColumn: "id",
    target: schema.numbatrakStockMovements,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      const productId = requireRef(row.product_id, insertedProductIds, diag, "product_id");
      if (!productId) return undefined;
      return {
        id: row.id,
        organizationId,
        movementType: row.movement_type,
        productId,
        quantity: row.quantity,
        fromAgentId: optionalRef(row.from_agent_id, insertedAgentIds, diag, "from_agent_id"),
        toAgentId: optionalRef(row.to_agent_id, insertedAgentIds, diag, "to_agent_id"),
        orderId: optionalRef(row.order_id, insertedCustomerOrderIds, diag, "order_id"),
        waybillBatchId: row.waybill_batch_id,
        legacyDeliveryId: row.legacy_delivery_id,
        occurredAt: row.occurred_at,
        cost: row.cost,
        fee: row.fee,
        recordedByUserId: optionalUser(row.recorded_by_user_id, diag, "recorded_by_user_id"),
        notes: row.notes,
        createdAt: row.created_at,
      };
    },
  });
}

async function migrateInventoryLegacy(): Promise<void> {
  await runMigration({
    label: "numbatrak_inventory_legacy",
    sourceTable: "inventory",
    pkColumn: "id",
    target: schema.numbatrakInventoryLegacy,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      const productId = requireRef(row.product_id, insertedProductIds, diag, "product_id");
      if (!productId) return undefined;
      return {
        id: row.id,
        organizationId,
        agentId: optionalRef(row.agent_id, insertedAgentIds, diag, "agent_id"),
        productId,
        totalQuantity: row.total_quantity,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
  });
}

async function migrateDeliveries(): Promise<void> {
  await runMigration({
    label: "numbatrak_deliveries",
    sourceTable: "deliveries",
    pkColumn: "id",
    target: schema.numbatrakDeliveries,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        date: row.date,
        csr: row.csr,
        agentId: optionalRef(row.agent_id, insertedAgentIds, diag, "agent_id"),
        status: row.status,
        // ANOMALY: no FK to numbatrak_products in source or target - copied
        // through verbatim, see deliveries.ts.
        productId: row.product_id,
        quantity: row.quantity,
        cost: row.cost,
        waybillingFee: row.waybilling_fee,
        createdAt: row.created_at,
        subBrand: row.sub_brand,
        waybillBatchId: row.waybill_batch_id,
      };
    },
  });
}

async function migrateUnifiedExpenses(): Promise<void> {
  await runMigration({
    label: "numbatrak_unified_expenses",
    sourceTable: "unified_expenses",
    pkColumn: "id",
    target: schema.numbatrakUnifiedExpenses,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        scope: row.scope,
        category: row.category,
        subcategory: row.subcategory,
        amount: row.amount,
        agentId: optionalRef(row.agent_id, insertedAgentIds, diag, "agent_id"),
        productId: optionalRef(row.product_id, insertedProductIds, diag, "product_id"),
        orderId: optionalRef(row.order_id, insertedCustomerOrderIds, diag, "order_id"),
        note: row.note,
        occurredAt: row.occurred_at,
        createdBy: optionalUser(row.created_by, diag, "created_by"),
        legacyAgentExpenseId: row.legacy_agent_expense_id,
        legacyGeneralExpenseId: row.legacy_general_expense_id,
        createdAt: row.created_at,
        sourceType: row.source_type,
        sourceId: row.source_id,
        offerName: row.offer_name,
        platform: row.platform,
      };
    },
    afterInsert: (row) => insertedUnifiedExpenseIds.add(row.id as string),
  });
}

async function migrateExpenseSubcategories(): Promise<void> {
  await runMigration({
    label: "numbatrak_expense_subcategories",
    sourceTable: "expense_subcategories",
    pkColumn: "id",
    target: schema.numbatrakExpenseSubcategories,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        parentCategory: row.parent_category,
        slug: row.slug,
        label: row.label,
        createdAt: row.created_at,
      };
    },
  });
}

async function migrateAgentExpensesLegacy(): Promise<void> {
  await runMigration({
    label: "numbatrak_agent_expenses_legacy",
    sourceTable: "agent_expenses",
    pkColumn: "id",
    target: schema.numbatrakAgentExpensesLegacy,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        date: row.date,
        category: row.category,
        amount: row.amount,
        agentId: optionalRef(row.agent_id, insertedAgentIds, diag, "agent_id"),
        createdAt: row.created_at,
      };
    },
  });
}

async function migrateWalletRemittanceLines(): Promise<void> {
  await runMigration({
    label: "numbatrak_wallet_remittance_lines",
    sourceTable: "wallet_remittance_lines",
    pkColumn: "id",
    target: schema.numbatrakWalletRemittanceLines,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      const agentId = requireRef(row.agent_id, insertedAgentIds, diag, "agent_id");
      if (agentId === undefined) return undefined;
      return {
        id: row.id,
        organizationId,
        agentId,
        remittanceDate: row.remittance_date,
        totalDeliveredValue: row.total_delivered_value,
        totalDeliveryFees: row.total_delivery_fees,
        netOffAmount: row.net_off_amount,
        expectedRemittance: row.expected_remittance,
        actualAmount: row.actual_amount,
        status: row.status,
        netOffExpenseId: optionalRef(row.net_off_expense_id, insertedUnifiedExpenseIds, diag, "net_off_expense_id"),
        notes: row.notes,
        remittedAt: row.remitted_at,
        remittedBy: optionalUser(row.remitted_by, diag, "remitted_by"),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
  });
}

async function migrateAbandonedCarts(): Promise<void> {
  await runMigration({
    label: "numbatrak_abandoned_carts",
    sourceTable: "abandoned_carts",
    pkColumn: "id",
    target: schema.numbatrakAbandonedCarts,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        formId: optionalRef(row.form_id, insertedFormIds, diag, "form_id"),
        pageUrl: row.page_url,
        filledFields: row.filled_fields,
        fieldValues: row.field_values,
        selectedProducts: row.selected_products,
        convertedToOrder: row.converted_to_order,
        convertedOrderId: optionalRef(row.converted_order_id, insertedCustomerOrderIds, diag, "converted_order_id"),
        abandonedAt: row.abandoned_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        customerName: row.customer_name,
        phoneNumber: row.phone_number,
        whatsappNumber: row.whatsapp_number,
        deliveryAddress: row.delivery_address,
        state: row.state,
        location: row.location,
        selectedPackage: row.selected_package,
        selectedItems: row.selected_items,
        productName: row.product_name,
        mailQuan: row.mail_quan,
        agentQuan: row.agent_quan,
        quantity: row.quantity,
        product2: row.product2,
        mailQuan2: row.mail_quan2,
        agentQuan2: row.agent_quan2,
        quantity2: row.quantity2,
        filledFieldsCount: row.filled_fields_count,
        note: row.note,
        subject: row.subject,
        orderDate: row.order_date,
        orderMonth: row.order_month,
        orderYear: row.order_year,
        costPrice: row.cost_price,
        deliveryFee: row.delivery_fee,
        profit: row.profit,
        orderStatus: row.order_status,
        deliveryDate: row.delivery_date,
        deliveryMonth: row.delivery_month,
        deliveryYear: row.delivery_year,
        confirmedDelivery: row.confirmed_delivery,
        agentName: row.agent_name,
        salesPrice: row.sales_price,
        funnelName: row.funnel_name,
        offerName: row.offer_name,
        subBrand: row.sub_brand,
      };
    },
    afterInsert: (row) => insertedAbandonedCartIds.add(row.id as string),
  });
}

async function migrateFollowUps(): Promise<void> {
  await runMigration({
    label: "numbatrak_follow_ups",
    sourceTable: "follow_ups",
    pkColumn: "id",
    target: schema.numbatrakFollowUps,
    mapRow: (row, diag) => {
      // organization_id is nullable in source; only map if present (unlike
      // every other table, a missing org here is NOT a reason to skip the
      // row - see follow-ups.ts).
      const oldOrgId = row.organization_id as string | null;
      const organizationId = oldOrgId ? mapOrgId(oldOrgId) : null;
      if (organizationId && !targetOrgIds.has(organizationId)) {
        bump(diag.nulledOptionalFk, "organization_id");
      }
      return {
        id: row.id,
        organizationId: organizationId && targetOrgIds.has(organizationId) ? organizationId : null,
        // ANOMALY: source FK targets the legacy `orders` table (out of
        // scope). Copied through as a plain value with no FK - see follow-ups.ts.
        orderId: row.order_id,
        abandonedCartId: optionalRef(row.abandoned_cart_id, insertedAbandonedCartIds, diag, "abandoned_cart_id"),
        assignedTo: optionalUser(row.assigned_to, diag, "assigned_to"),
        status: row.status,
        priority: row.priority,
        startedAt: row.started_at,
        firstContactAt: row.first_contact_at,
        completedAt: row.completed_at,
        responseTimeMinutes: row.response_time_minutes,
        resolutionTimeMinutes: row.resolution_time_minutes,
        outcome: row.outcome,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
  });
}

async function migrateOrderAssignmentSettings(): Promise<void> {
  await runMigration({
    label: "numbatrak_order_assignment_settings",
    sourceTable: "order_assignment_settings",
    pkColumn: "id",
    target: schema.numbatrakOrderAssignmentSettings,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      return {
        id: row.id,
        organizationId,
        assignmentMethod: row.assignment_method,
        lastAssignedUserId: optionalUser(row.last_assigned_user_id, diag, "last_assigned_user_id"),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
  });
}

async function migrateOrderAssignmentWeights(): Promise<void> {
  await runMigration({
    label: "numbatrak_order_assignment_weights",
    sourceTable: "order_assignment_weights",
    pkColumn: "id",
    target: schema.numbatrakOrderAssignmentWeights,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      const userId = requireUser(row.user_id, diag, "user_id");
      if (!userId) return undefined;
      return {
        id: row.id,
        organizationId,
        userId,
        percentage: row.percentage,
        isPaused: row.is_paused,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
  });
}

async function migrateActivities(): Promise<void> {
  await runMigration({
    label: "numbatrak_activities",
    sourceTable: "activities",
    pkColumn: "id",
    target: schema.numbatrakActivities,
    mapRow: (row, diag) => {
      const organizationId = requireOrg(row, diag);
      if (!organizationId) return undefined;
      const userId = requireUser(row.user_id, diag, "user_id");
      if (!userId) return undefined;
      return {
        id: row.id,
        organizationId,
        userId,
        userName: row.user_name,
        actionType: row.action_type,
        entityType: row.entity_type,
        entityId: row.entity_id,
        description: row.description,
        metadata: row.metadata,
        createdAt: row.created_at,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Numbatrak data migration starting${DRY_RUN ? " (--dry-run, no writes)" : ""}...`);
  await openSourceReadOnly();
  await loadTargetReferenceSets();

  await migrateAgents();
  await migrateCsrNameAliases();
  await migrateProducts();
  await migrateProductVariants();
  await migrateProductOffers();
  await migrateProductPriceHistory();
  await migrateForms();
  await migrateFormProducts();
  await migrateFormResponses();
  await migrateFormResponseSelfRefs();
  await migrateFormResponseItems();
  await migrateInventoryLots();
  await migrateCustomerOrders();
  await migrateCustomerOrderItems();
  await migrateOrderInventoryConsumption();
  await migrateStockMovements();
  await migrateInventoryLegacy();
  await migrateDeliveries();
  await migrateUnifiedExpenses();
  await migrateExpenseSubcategories();
  await migrateAgentExpensesLegacy();
  await migrateWalletRemittanceLines();
  await migrateAbandonedCarts();
  await migrateFollowUps();
  await migrateOrderAssignmentSettings();
  await migrateOrderAssignmentWeights();
  await migrateActivities();

  console.log("\n=== Summary ===");
  for (const [label, diag] of diagnostics) {
    console.log(`${label}:`, diag);
  }

  await source.end();
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
