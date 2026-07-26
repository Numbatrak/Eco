-- Follow-ups stabilization: spec statuses, outcomes, auto-create on abandon, CSR picker

-- ---------------------------------------------------------------------------
-- Status + outcome alignment (drop CHECK before backfill — new values are
-- not allowed under the legacy constraint)
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_ups DROP CONSTRAINT IF EXISTS follow_ups_status_check;
ALTER TABLE public.follow_ups DROP CONSTRAINT IF EXISTS follow_ups_outcome_check;

UPDATE public.follow_ups SET status = 'awaiting' WHERE status = 'pending';
UPDATE public.follow_ups SET status = 'followed_up' WHERE status = 'in_progress';
UPDATE public.follow_ups SET status = 'resolved' WHERE status = 'completed';
UPDATE public.follow_ups SET outcome = 'not_converted' WHERE outcome = 'not_interested';

ALTER TABLE public.follow_ups
  ADD CONSTRAINT follow_ups_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'awaiting'::text,
        'followed_up'::text,
        'resolved'::text,
        'cancelled'::text
      ]
    )
  );

ALTER TABLE public.follow_ups
  ADD CONSTRAINT follow_ups_outcome_check
  CHECK (
    outcome IS NULL OR outcome = ANY (
      ARRAY[
        'converted'::text,
        'not_converted'::text,
        'not_interested'::text,
        'follow_up_needed'::text,
        'resolved'::text,
        'other'::text
      ]
    )
  );
COMMENT ON COLUMN public.follow_ups.response_time_minutes IS
  'Work-hours from cart/order landing (abandoned_at) to first CSR contact.';

-- ---------------------------------------------------------------------------
-- Pick least-busy Customer Relations rep for auto-assignment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pick_csr_for_follow_up(p_org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT om.user_id
  FROM public.organization_members om
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS workload
    FROM public.follow_ups fu
    WHERE fu.organization_id = p_org_id
      AND fu.assigned_to = om.user_id
      AND fu.status IN ('awaiting', 'followed_up', 'pending', 'in_progress')
  ) w ON true
  WHERE om.organization_id = p_org_id
    AND om.role = 'Customer Relations'
  ORDER BY w.workload ASC NULLS LAST, om.user_id
  LIMIT 1;
$$;

-- Auto-create follow-up when a new abandoned cart is captured
CREATE OR REPLACE FUNCTION public.auto_create_follow_up_for_abandoned_cart()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_csr uuid;
BEGIN
  IF NEW.customer_name IS NULL OR TRIM(NEW.customer_name) = '' THEN
    RETURN NEW;
  END IF;
  IF (NEW.phone_number IS NULL OR TRIM(NEW.phone_number) = '')
     AND (NEW.whatsapp_number IS NULL OR TRIM(NEW.whatsapp_number) = '') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.follow_ups fu WHERE fu.abandoned_cart_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  v_csr := public.pick_csr_for_follow_up(NEW.organization_id);

  INSERT INTO public.follow_ups (
    organization_id,
    abandoned_cart_id,
    assigned_to,
    status,
    priority,
    notes
  ) VALUES (
    NEW.organization_id,
    NEW.id,
    v_csr,
    'awaiting',
    'medium',
    'Auto-created from abandoned cart capture'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_follow_up_on_abandoned_cart ON public.abandoned_carts;
CREATE TRIGGER trg_auto_follow_up_on_abandoned_cart
  AFTER INSERT ON public.abandoned_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_follow_up_for_abandoned_cart();
