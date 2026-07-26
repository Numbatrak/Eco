-- Normalized primary state for agents (Nigeria ops). Keeps locations text for display.
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS state text;

COMMENT ON COLUMN public.agents.state IS 'Primary state/region for reporting; locations may list multiple areas';

-- Optional: parse first location from legacy comma-separated `locations` when state is null
UPDATE public.agents
SET state = TRIM(SPLIT_PART(locations, ',', 1))
WHERE (state IS NULL OR state = '')
  AND locations IS NOT NULL
  AND TRIM(locations) <> '';
