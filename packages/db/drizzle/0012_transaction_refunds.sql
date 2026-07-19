ALTER TABLE "platform_transactions" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_transactions" ADD COLUMN "refund_reason" text;--> statement-breakpoint
CREATE INDEX "platform_transactions_refunded_at_idx" ON "platform_transactions" USING btree ("refunded_at");
