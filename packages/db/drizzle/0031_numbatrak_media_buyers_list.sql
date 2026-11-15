CREATE TABLE "numbatrak_media_buyers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "numbatrak_tracking_links" ALTER COLUMN "form_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "numbatrak_tracking_links" ADD COLUMN "media_buyer_id" uuid;--> statement-breakpoint
ALTER TABLE "numbatrak_media_buyers" ADD CONSTRAINT "numbatrak_media_buyers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_media_buyers_org_name_unique_idx" ON "numbatrak_media_buyers" USING btree ("organization_id",lower("name"));--> statement-breakpoint
ALTER TABLE "numbatrak_tracking_links" ADD CONSTRAINT "numbatrak_tracking_links_media_buyer_id_numbatrak_media_buyers_id_fk" FOREIGN KEY ("media_buyer_id") REFERENCES "public"."numbatrak_media_buyers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- Backfill: seed each org's buyer list from the names already typed on its
-- tracking links (one entry per case-insensitive name, keeping the first
-- spelling used), then point every existing link at its buyer.
INSERT INTO "numbatrak_media_buyers" ("organization_id", "name")
SELECT DISTINCT ON ("organization_id", lower(trim("media_buyer_name"))) "organization_id", trim("media_buyer_name")
FROM "numbatrak_tracking_links"
WHERE trim("media_buyer_name") <> ''
ORDER BY "organization_id", lower(trim("media_buyer_name")), "created_at";--> statement-breakpoint
UPDATE "numbatrak_tracking_links" tl
SET "media_buyer_id" = mb."id"
FROM "numbatrak_media_buyers" mb
WHERE mb."organization_id" = tl."organization_id"
  AND lower(mb."name") = lower(trim(tl."media_buyer_name"))
  AND tl."media_buyer_id" IS NULL;
