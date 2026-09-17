CREATE TABLE "numbatrak_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by" text,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "numbatrak_api_keys" ADD CONSTRAINT "numbatrak_api_keys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_api_keys" ADD CONSTRAINT "numbatrak_api_keys_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "numbatrak_api_keys_org_idx" ON "numbatrak_api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_api_keys_hash_unique_idx" ON "numbatrak_api_keys" USING btree ("key_hash");