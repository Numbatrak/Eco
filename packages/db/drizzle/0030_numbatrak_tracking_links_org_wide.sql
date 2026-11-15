ALTER TABLE "numbatrak_tracking_links" ALTER COLUMN "form_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "numbatrak_abandoned_carts" ADD COLUMN "tracking_link_id" uuid;--> statement-breakpoint
ALTER TABLE "numbatrak_abandoned_carts" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "numbatrak_abandoned_carts" ADD COLUMN "media_buyer_name" text;--> statement-breakpoint
ALTER TABLE "numbatrak_abandoned_carts" ADD CONSTRAINT "numbatrak_abandoned_carts_tracking_link_id_numbatrak_tracking_links_id_fk" FOREIGN KEY ("tracking_link_id") REFERENCES "public"."numbatrak_tracking_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "numbatrak_abandoned_carts_tracking_link_idx" ON "numbatrak_abandoned_carts" USING btree ("organization_id","tracking_link_id") WHERE "numbatrak_abandoned_carts"."tracking_link_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_abandoned_carts_media_buyer_idx" ON "numbatrak_abandoned_carts" USING btree ("organization_id","media_buyer_name") WHERE "numbatrak_abandoned_carts"."media_buyer_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_abandoned_carts_platform_idx" ON "numbatrak_abandoned_carts" USING btree ("organization_id","platform") WHERE "numbatrak_abandoned_carts"."platform" IS NOT NULL;