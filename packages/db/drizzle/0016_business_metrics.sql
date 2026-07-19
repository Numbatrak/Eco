CREATE TYPE "expense_parent_category" AS ENUM ('advertising', 'marketing', 'building', 'operational');
--> statement-breakpoint
CREATE TABLE "expense_sub_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_category" "expense_parent_category" NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "expense_sub_categories_parent_idx" ON "expense_sub_categories" USING btree ("parent_category");
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_category" "expense_parent_category" NOT NULL,
	"sub_category_id" uuid,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_by_admin_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "expenses_occurred_at_idx" ON "expenses" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX "expenses_parent_category_idx" ON "expenses" USING btree ("parent_category");
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_sub_category_id_expense_sub_categories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."expense_sub_categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("recorded_by_admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;
