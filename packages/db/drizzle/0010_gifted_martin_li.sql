CREATE TABLE "numbatrak_inventory_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"default_low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_delivery_agent_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"default_agent_delivery_fee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "numbatrak_agents" ADD COLUMN "delivery_fee_override" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "numbatrak_inventory_settings" ADD CONSTRAINT "numbatrak_inventory_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_delivery_agent_settings" ADD CONSTRAINT "numbatrak_delivery_agent_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_inventory_settings_org_unique_idx" ON "numbatrak_inventory_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_delivery_agent_settings_org_unique_idx" ON "numbatrak_delivery_agent_settings" USING btree ("organization_id");