CREATE TABLE "numbatrak_dashboard_alert_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"delivery_rate_green" numeric(14, 4) DEFAULT '70' NOT NULL,
	"delivery_rate_amber" numeric(14, 4) DEFAULT '50' NOT NULL,
	"delivery_rate_alert" numeric(14, 4) DEFAULT '65' NOT NULL,
	"roas_green" numeric(14, 4) DEFAULT '3' NOT NULL,
	"roas_amber" numeric(14, 4) DEFAULT '1.5' NOT NULL,
	"profit_per_order_green" numeric(14, 4) DEFAULT '500' NOT NULL,
	"profit_per_order_amber" numeric(14, 4) DEFAULT '0' NOT NULL,
	"business_roi_green" numeric(14, 4) DEFAULT '0.2' NOT NULL,
	"business_roi_amber" numeric(14, 4) DEFAULT '0' NOT NULL,
	"real_cpa_aov_green" numeric(14, 4) DEFAULT '0.35' NOT NULL,
	"real_cpa_aov_amber" numeric(14, 4) DEFAULT '0.55' NOT NULL,
	"min_undelivered_for_alert" numeric(14, 4) DEFAULT '3' NOT NULL,
	"min_would_be_sales_for_alert" numeric(14, 4) DEFAULT '25000' NOT NULL,
	"cpa_week_on_week_increase_pct" numeric(14, 4) DEFAULT '15' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "numbatrak_dashboard_alert_thresholds" ADD CONSTRAINT "numbatrak_dashboard_alert_thresholds_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_dashboard_alert_thresholds_org_unique_idx" ON "numbatrak_dashboard_alert_thresholds" USING btree ("organization_id");