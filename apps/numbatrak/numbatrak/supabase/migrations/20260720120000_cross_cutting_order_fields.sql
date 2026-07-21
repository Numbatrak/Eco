-- Cross-cutting stabilization: funnel/offer/sub-brand attribution + money_received_by (spec §Orders, §Wallet)
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE

-- ---------------------------------------------------------------------------
-- forms: optional sub-brand and funnel label (funnel defaults to form name in app)
-- ---------------------------------------------------------------------------
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS sub_brand text,
  ADD COLUMN IF NOT EXISTS funnel_name text;

COMMENT ON COLUMN public.forms.sub_brand IS
  'Optional sub-brand tag; copied onto orders for filtering and roll-ups';
COMMENT ON COLUMN public.forms.funnel_name IS
  'Optional funnel display name; when null the app uses forms.name';

-- ---------------------------------------------------------------------------
-- form_responses + customer_orders: attribution + who received the money
-- ---------------------------------------------------------------------------
ALTER TABLE public.form_responses
  ADD COLUMN IF NOT EXISTS funnel_name text,
  ADD COLUMN IF NOT EXISTS sub_brand text;

ALTER TABLE public.form_responses
  ADD COLUMN IF NOT EXISTS money_received_by text;

UPDATE public.form_responses
SET money_received_by = CASE
  WHEN payment_method = 'online' THEN 'prepaid'
  ELSE 'agent_collected'
END
WHERE money_received_by IS NULL;

ALTER TABLE public.form_responses
  ALTER COLUMN money_received_by SET DEFAULT 'agent_collected';

ALTER TABLE public.form_responses
  DROP CONSTRAINT IF EXISTS form_responses_money_received_by_chk;

ALTER TABLE public.form_responses
  ADD CONSTRAINT form_responses_money_received_by_chk
  CHECK (money_received_by IN ('agent_collected', 'company_account', 'prepaid'));

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS offer_name text,
  ADD COLUMN IF NOT EXISTS funnel_name text,
  ADD COLUMN IF NOT EXISTS sub_brand text;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS money_received_by text;

UPDATE public.customer_orders
SET money_received_by = CASE
  WHEN payment_method = 'online' THEN 'prepaid'
  ELSE 'agent_collected'
END
WHERE money_received_by IS NULL;

ALTER TABLE public.customer_orders
  ALTER COLUMN money_received_by SET DEFAULT 'agent_collected';

ALTER TABLE public.customer_orders
  DROP CONSTRAINT IF EXISTS customer_orders_money_received_by_chk;

ALTER TABLE public.customer_orders
  ADD CONSTRAINT customer_orders_money_received_by_chk
  CHECK (money_received_by IN ('agent_collected', 'company_account', 'prepaid'));

-- Backfill attribution from linked form_responses / forms
UPDATE public.form_responses fr
SET
  funnel_name = COALESCE(fr.funnel_name, f.funnel_name, f.name),
  sub_brand = COALESCE(fr.sub_brand, f.sub_brand)
FROM public.forms f
WHERE f.id = fr.form_id
  AND fr.form_id IS NOT NULL
  AND (fr.funnel_name IS NULL OR fr.sub_brand IS NULL);

UPDATE public.customer_orders co
SET
  offer_name = COALESCE(co.offer_name, fr.offer_name),
  funnel_name = COALESCE(co.funnel_name, fr.funnel_name, f.funnel_name, f.name),
  sub_brand = COALESCE(co.sub_brand, fr.sub_brand, f.sub_brand),
  money_received_by = COALESCE(co.money_received_by, fr.money_received_by, 'agent_collected')
FROM public.form_responses fr
LEFT JOIN public.forms f ON f.id = fr.form_id
WHERE co.form_response_id = fr.id;

CREATE INDEX IF NOT EXISTS idx_customer_orders_sub_brand
  ON public.customer_orders (organization_id, sub_brand)
  WHERE sub_brand IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_orders_funnel
  ON public.customer_orders (organization_id, funnel_name)
  WHERE funnel_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_orders_offer
  ON public.customer_orders (organization_id, offer_name)
  WHERE offer_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_orders_money_received
  ON public.customer_orders (organization_id, money_received_by)
  WHERE status = 'completed';

COMMENT ON COLUMN public.customer_orders.money_received_by IS
  'Spec: agent_collected → Wallet remittance; company_account/prepaid → cash already in hand';

-- ---------------------------------------------------------------------------
-- Wallet init: only agent_collected COD creates a remittance line
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.init_wallet_status_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.money_received_by IS DISTINCT FROM 'agent_collected' THEN
      NEW.wallet_status := NULL;
      NEW.remittance_confirmed_at := NULL;
      NEW.remittance_confirmed_by := NULL;
      NEW.released_at := NULL;
      NEW.released_by := NULL;
    ELSIF NEW.payment_method = 'online' THEN
      NEW.wallet_status := COALESCE(NEW.wallet_status, 'collected');
      NEW.remittance_confirmed_at := COALESCE(NEW.remittance_confirmed_at, NOW());
    ELSE
      NEW.wallet_status := COALESCE(NEW.wallet_status, 'pending_remittance');
    END IF;
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
  ELSIF NEW.status IS DISTINCT FROM 'completed' AND OLD.status = 'completed' THEN
    NEW.wallet_status := NULL;
    NEW.remittance_confirmed_at := NULL;
    NEW.remittance_confirmed_by := NULL;
    NEW.released_at := NULL;
    NEW.released_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Clear wallet rows that should never have been remittance (backfill)
UPDATE public.form_responses
SET
  wallet_status = NULL,
  remittance_confirmed_at = NULL,
  remittance_confirmed_by = NULL,
  released_at = NULL,
  released_by = NULL
WHERE status = 'completed'
  AND response_type = 'order'
  AND money_received_by IS DISTINCT FROM 'agent_collected'
  AND wallet_status IS NOT NULL;

UPDATE public.customer_orders
SET
  wallet_status = NULL,
  remittance_confirmed_at = NULL,
  remittance_confirmed_by = NULL,
  released_at = NULL,
  released_by = NULL
WHERE status = 'completed'
  AND money_received_by IS DISTINCT FROM 'agent_collected'
  AND wallet_status IS NOT NULL;

-- Mirror attribution + money_received_by form_responses → customer_orders
CREATE OR REPLACE FUNCTION public.sync_order_attribution_to_customer_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.customer_orders co
  SET
    offer_name = NEW.offer_name,
    funnel_name = NEW.funnel_name,
    sub_brand = NEW.sub_brand,
    money_received_by = NEW.money_received_by,
    payment_method = NEW.payment_method,
    wallet_status = NEW.wallet_status,
    remittance_confirmed_at = NEW.remittance_confirmed_at,
    remittance_confirmed_by = NEW.remittance_confirmed_by,
    released_at = NEW.released_at,
    released_by = NEW.released_by
  WHERE co.form_response_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_wallet_form_to_customer ON public.form_responses;
CREATE TRIGGER trg_sync_attribution_form_to_customer
  AFTER UPDATE OF offer_name, funnel_name, sub_brand, money_received_by,
    payment_method, wallet_status, remittance_confirmed_at,
    remittance_confirmed_by, released_at, released_by
  ON public.form_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_attribution_to_customer_order();

-- Stamp funnel/sub-brand from form on new submissions
CREATE OR REPLACE FUNCTION public.stamp_order_attribution_from_form()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_funnel text;
  v_sub_brand text;
BEGIN
  IF NEW.form_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(NULLIF(TRIM(f.funnel_name), ''), f.name), f.sub_brand
  INTO v_funnel, v_sub_brand
  FROM public.forms f
  WHERE f.id = NEW.form_id;

  NEW.funnel_name := COALESCE(NEW.funnel_name, v_funnel);
  NEW.sub_brand := COALESCE(NEW.sub_brand, v_sub_brand);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_form_response_attribution ON public.form_responses;
CREATE TRIGGER trg_stamp_form_response_attribution
  BEFORE INSERT OR UPDATE OF form_id ON public.form_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_order_attribution_from_form();

DROP TRIGGER IF EXISTS trg_stamp_customer_order_attribution ON public.customer_orders;
CREATE TRIGGER trg_stamp_customer_order_attribution
  BEFORE INSERT OR UPDATE OF form_id ON public.customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_order_attribution_from_form();
