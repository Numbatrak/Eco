CREATE TABLE "numbatrak_order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "numbatrak_notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"daily_summary_enabled" boolean DEFAULT true NOT NULL,
	"additional_recipients" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_analytics_settings" ADD COLUMN "tiktok_pixel_id" text;--> statement-breakpoint
ALTER TABLE "tenant_analytics_settings" ADD COLUMN "tiktok_capi_token_encrypted" text;--> statement-breakpoint
ALTER TABLE "numbatrak_order_status_history" ADD CONSTRAINT "numbatrak_order_status_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_order_status_history" ADD CONSTRAINT "numbatrak_order_status_history_order_id_numbatrak_customer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."numbatrak_customer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_order_status_history" ADD CONSTRAINT "numbatrak_order_status_history_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_notification_settings" ADD CONSTRAINT "numbatrak_notification_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "numbatrak_order_status_history_order_idx" ON "numbatrak_order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "numbatrak_order_status_history_org_idx" ON "numbatrak_order_status_history" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_notification_settings_org_unique_idx" ON "numbatrak_notification_settings" USING btree ("organization_id");