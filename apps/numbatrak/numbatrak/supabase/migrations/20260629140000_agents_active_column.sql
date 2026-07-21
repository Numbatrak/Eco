-- Soft-deactivate agents: preserve history, exclude from new order assignment.

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agents_active ON public.agents (active);

COMMENT ON COLUMN public.agents.active IS 'When false, agent is deactivated and excluded from new order/delivery assignment.';
