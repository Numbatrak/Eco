ALTER TABLE "numbatrak_star_settings" ADD COLUMN "leaderboard_style" text DEFAULT 'by_tier' NOT NULL;--> statement-breakpoint
ALTER TABLE "numbatrak_star_settings" ADD COLUMN "sotm_strike_disqualifies" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "numbatrak_star_settings" ADD COLUMN "sotm_prize_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "numbatrak_star_tiers" ADD COLUMN "criteria" text;--> statement-breakpoint
ALTER TABLE "numbatrak_stars" ADD COLUMN "tier_id" uuid;--> statement-breakpoint
ALTER TABLE "numbatrak_stars" ADD CONSTRAINT "numbatrak_stars_tier_id_numbatrak_star_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."numbatrak_star_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "numbatrak_stars_staff_awarded_idx" ON "numbatrak_stars" USING btree ("staff_id","awarded_at");--> statement-breakpoint
ALTER TABLE "numbatrak_star_settings" ADD CONSTRAINT "numbatrak_star_settings_leaderboard_style_chk" CHECK ("numbatrak_star_settings"."leaderboard_style" IN ('by_tier', 'by_revenue', 'by_delivery_rate', 'by_upsells'));