CREATE TABLE "numbatrak_agent_assignment_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"state" text NOT NULL,
	"last_assigned_agent_id" bigint,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "numbatrak_agent_assignment_state" ADD CONSTRAINT "numbatrak_agent_assignment_state_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_agent_assignment_state" ADD CONSTRAINT "numbatrak_agent_assignment_state_last_assigned_agent_id_numbatrak_agents_id_fk" FOREIGN KEY ("last_assigned_agent_id") REFERENCES "public"."numbatrak_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_agent_assignment_state_org_state_unique_idx" ON "numbatrak_agent_assignment_state" USING btree ("organization_id","state");