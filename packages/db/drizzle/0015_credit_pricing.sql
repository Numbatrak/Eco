CREATE TABLE "platform_credit_pricing" (
	"credit_type" "platform_credit_type" PRIMARY KEY NOT NULL,
	"sell_price_cents" integer DEFAULT 0 NOT NULL,
	"provider_cost_cents" integer DEFAULT 0 NOT NULL,
	"updated_by_admin_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_credit_pricing" ADD CONSTRAINT "platform_credit_pricing_updated_by_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "platform_credit_pricing" ("credit_type", "sell_price_cents", "provider_cost_cents") VALUES ('email', 0, 0), ('whatsapp', 0, 0);
--> statement-breakpoint
CREATE TABLE "credit_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_type" "platform_credit_type" NOT NULL,
	"name" text NOT NULL,
	"units" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "credit_bundles_type_idx" ON "credit_bundles" USING btree ("credit_type");
