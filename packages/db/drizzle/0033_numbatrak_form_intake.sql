CREATE TABLE "numbatrak_form_intake_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD COLUMN "submitted_data" jsonb;--> statement-breakpoint
ALTER TABLE "numbatrak_abandoned_carts" ADD COLUMN "submitted_data" jsonb;--> statement-breakpoint
ALTER TABLE "numbatrak_form_intake_settings" ADD CONSTRAINT "numbatrak_form_intake_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_form_intake_settings_token_unique_idx" ON "numbatrak_form_intake_settings" USING btree ("token");