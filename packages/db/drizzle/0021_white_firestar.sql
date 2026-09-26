CREATE TABLE "numbatrak_tracking_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"form_id" uuid NOT NULL,
	"offer_id" text,
	"offer_label" text,
	"media_buyer_name" text NOT NULL,
	"platform" text NOT NULL,
	"label" text,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD COLUMN "tracking_link_id" uuid;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD COLUMN "media_buyer_name" text;--> statement-breakpoint
ALTER TABLE "numbatrak_ad_spend" ADD COLUMN "tracking_link_id" uuid;--> statement-breakpoint
ALTER TABLE "numbatrak_tracking_links" ADD CONSTRAINT "numbatrak_tracking_links_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_tracking_links" ADD CONSTRAINT "numbatrak_tracking_links_form_id_numbatrak_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."numbatrak_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "numbatrak_tracking_links_org_idx" ON "numbatrak_tracking_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_tracking_links_form_idx" ON "numbatrak_tracking_links" USING btree ("form_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_tracking_links_org_code_unique_idx" ON "numbatrak_tracking_links" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "numbatrak_tracking_links_media_buyer_idx" ON "numbatrak_tracking_links" USING btree ("organization_id","media_buyer_name");--> statement-breakpoint
CREATE INDEX "numbatrak_tracking_links_platform_idx" ON "numbatrak_tracking_links" USING btree ("organization_id","platform");--> statement-breakpoint
CREATE INDEX "numbatrak_tracking_links_active_idx" ON "numbatrak_tracking_links" USING btree ("organization_id") WHERE "numbatrak_tracking_links"."active" = true;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD CONSTRAINT "numbatrak_customer_orders_tracking_link_id_numbatrak_tracking_links_id_fk" FOREIGN KEY ("tracking_link_id") REFERENCES "public"."numbatrak_tracking_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_ad_spend" ADD CONSTRAINT "numbatrak_ad_spend_tracking_link_id_numbatrak_tracking_links_id_fk" FOREIGN KEY ("tracking_link_id") REFERENCES "public"."numbatrak_tracking_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_tracking_link_idx" ON "numbatrak_customer_orders" USING btree ("organization_id","tracking_link_id") WHERE "numbatrak_customer_orders"."tracking_link_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_platform_idx" ON "numbatrak_customer_orders" USING btree ("organization_id","platform") WHERE "numbatrak_customer_orders"."platform" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_media_buyer_idx" ON "numbatrak_customer_orders" USING btree ("organization_id","media_buyer_name") WHERE "numbatrak_customer_orders"."media_buyer_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_ad_spend_tracking_link_idx" ON "numbatrak_ad_spend" USING btree ("tracking_link_id") WHERE "numbatrak_ad_spend"."tracking_link_id" IS NOT NULL;