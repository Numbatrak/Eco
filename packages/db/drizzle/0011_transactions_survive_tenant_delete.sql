ALTER TABLE "platform_transactions" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_transactions" DROP CONSTRAINT "platform_transactions_organization_id_organization_id_fk";--> statement-breakpoint
ALTER TABLE "platform_transactions" ADD CONSTRAINT "platform_transactions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
