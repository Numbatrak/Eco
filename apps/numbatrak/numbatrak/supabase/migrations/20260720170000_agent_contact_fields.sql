-- Agent contact fields (spec §6 — external delivery partner contact)

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text;

COMMENT ON COLUMN public.agents.contact_person IS
  'Primary contact name at the delivery partner (optional)';

COMMENT ON COLUMN public.agents.contact_phone IS
  'Phone or WhatsApp for reaching the agent';

COMMENT ON COLUMN public.agents.contact_email IS
  'Optional email for the delivery partner';
