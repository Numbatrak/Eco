ALTER TABLE "numbatrak_staff" ADD COLUMN "employment_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD COLUMN "on_probation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD COLUMN "probation_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD COLUMN "deactivated_by" text;--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD COLUMN "deactivation_reason" text;--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_lines" ADD COLUMN "paid_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_lines" ADD COLUMN "paid_by" text;--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_lines" ADD COLUMN "paid_notes" text;--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_runs" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_runs" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_runs" ADD COLUMN "closed_by" text;--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD CONSTRAINT "numbatrak_staff_deactivated_by_user_id_fk" FOREIGN KEY ("deactivated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_lines" ADD CONSTRAINT "numbatrak_payroll_lines_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_runs" ADD CONSTRAINT "numbatrak_payroll_runs_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD CONSTRAINT "numbatrak_staff_employment_status_chk" CHECK ("numbatrak_staff"."employment_status" IN ('active', 'inactive', 'suspended', 'on_leave'));--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_runs" ADD CONSTRAINT "numbatrak_payroll_runs_status_chk" CHECK ("numbatrak_payroll_runs"."status" IN ('open', 'closed'));