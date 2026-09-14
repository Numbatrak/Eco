-- Product decision: rename NumbaTrak's "Wallet" feature back to its
-- original name, "Remittance", everywhere (module, routes, schema, UI).
-- All renames below use ALTER ... RENAME so existing data is preserved.

-- Remittance lines table
ALTER TABLE "numbatrak_wallet_remittance_lines" RENAME TO "numbatrak_remittance_lines";--> statement-breakpoint
ALTER TABLE "numbatrak_remittance_lines" RENAME CONSTRAINT "numbatrak_wallet_remittance_lines_organization_id_organization_" TO "numbatrak_remittance_lines_organization_id_organization_";--> statement-breakpoint
ALTER TABLE "numbatrak_remittance_lines" RENAME CONSTRAINT "numbatrak_wallet_remittance_lines_agent_id_numbatrak_agents_id_" TO "numbatrak_remittance_lines_agent_id_numbatrak_agents_id_";--> statement-breakpoint
ALTER TABLE "numbatrak_remittance_lines" RENAME CONSTRAINT "numbatrak_wallet_remittance_lines_net_off_expense_id_numbatrak_" TO "numbatrak_remittance_lines_net_off_expense_id_numbatrak_";--> statement-breakpoint
ALTER TABLE "numbatrak_remittance_lines" RENAME CONSTRAINT "numbatrak_wallet_remittance_lines_remitted_by_user_id_fk" TO "numbatrak_remittance_lines_remitted_by_user_id_fk";--> statement-breakpoint
ALTER TABLE "numbatrak_remittance_lines" RENAME CONSTRAINT "numbatrak_wallet_remittance_lines_status_chk" TO "numbatrak_remittance_lines_status_chk";--> statement-breakpoint
ALTER TABLE "numbatrak_remittance_lines" RENAME CONSTRAINT "numbatrak_wallet_remittance_lines_pkey" TO "numbatrak_remittance_lines_pkey";--> statement-breakpoint
ALTER INDEX "numbatrak_wallet_remittance_lines_org_date_idx" RENAME TO "numbatrak_remittance_lines_org_date_idx";--> statement-breakpoint
ALTER INDEX "numbatrak_wallet_remittance_lines_org_agent_idx" RENAME TO "numbatrak_remittance_lines_org_agent_idx";--> statement-breakpoint
ALTER INDEX "numbatrak_wallet_remittance_lines_org_agent_date_unique_idx" RENAME TO "numbatrak_remittance_lines_org_agent_date_unique_idx";--> statement-breakpoint

-- wallet_status column -> remittance_status, on both order-shaped tables
ALTER TABLE "numbatrak_form_responses" RENAME COLUMN "wallet_status" TO "remittance_status";--> statement-breakpoint
ALTER TABLE "numbatrak_form_responses" RENAME CONSTRAINT "numbatrak_form_responses_wallet_status_chk" TO "numbatrak_form_responses_remittance_status_chk";--> statement-breakpoint
ALTER INDEX "numbatrak_form_responses_wallet_idx" RENAME TO "numbatrak_form_responses_remittance_idx";--> statement-breakpoint

ALTER TABLE "numbatrak_customer_orders" RENAME COLUMN "wallet_status" TO "remittance_status";--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" RENAME CONSTRAINT "numbatrak_customer_orders_wallet_status_chk" TO "numbatrak_customer_orders_remittance_status_chk";--> statement-breakpoint
ALTER INDEX "numbatrak_customer_orders_wallet_idx" RENAME TO "numbatrak_customer_orders_remittance_idx";--> statement-breakpoint

-- Backfill the expense source_type literal to match the new naming
UPDATE "numbatrak_unified_expenses" SET "source_type" = 'remittance_net_off' WHERE "source_type" = 'wallet_net_off';
