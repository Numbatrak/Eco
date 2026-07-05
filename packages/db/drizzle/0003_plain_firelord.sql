ALTER TABLE "tenant_site_config" ADD COLUMN "products_grid_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO "permissions" ("key", "description") VALUES
	('orders.view', 'View the tenant''s orders')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
-- Backfill: grant orders.view to every existing tenant_member that already
-- has payments.manage (i.e. owner/admin under the current role mapping),
-- since permissions are granted once at tenant_member creation time, not
-- derived live from role - members created before this migration need the
-- same backfill an app-level role-permission-sync job would otherwise do.
INSERT INTO "tenant_member_permissions" ("tenant_member_id", "permission_key")
SELECT tmp."tenant_member_id", 'orders.view'
FROM "tenant_member_permissions" tmp
WHERE tmp."permission_key" = 'payments.manage'
ON CONFLICT ("tenant_member_id", "permission_key") DO NOTHING;