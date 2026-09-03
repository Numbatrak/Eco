ALTER TABLE "numbatrak_staff" ADD COLUMN "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD CONSTRAINT "numbatrak_staff_manager_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."numbatrak_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "numbatrak_staff_manager_idx" ON "numbatrak_staff" USING btree ("manager_id");--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD CONSTRAINT "numbatrak_staff_manager_not_self_chk" CHECK ("numbatrak_staff"."manager_id" IS NULL OR "numbatrak_staff"."manager_id" <> "numbatrak_staff"."id");