CREATE TABLE "numbatrak_delivery_fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"state" text,
	"fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "numbatrak_deliveries" ADD COLUMN "recorded_by_user_id" text;--> statement-breakpoint
ALTER TABLE "numbatrak_delivery_fee_rules" ADD CONSTRAINT "numbatrak_delivery_fee_rules_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "numbatrak_delivery_fee_rules_org_idx" ON "numbatrak_delivery_fee_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_delivery_fee_rules_org_default_unique_idx" ON "numbatrak_delivery_fee_rules" USING btree ("organization_id") WHERE "numbatrak_delivery_fee_rules"."state" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_delivery_fee_rules_org_state_unique_idx" ON "numbatrak_delivery_fee_rules" USING btree ("organization_id","state") WHERE "numbatrak_delivery_fee_rules"."state" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "numbatrak_deliveries" ADD CONSTRAINT "numbatrak_deliveries_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;