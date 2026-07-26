-- Wallet / remittance tracking (Developer Brief §04)
-- Tracks COD remittance flow: delivered → pending → collected → released

ALTER TABLE public.form_responses
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cod'
    CHECK (payment_method IN ('cod', 'online')),
  ADD COLUMN IF NOT EXISTS wallet_status text
    CHECK (wallet_status IN ('pending_remittance', 'collected', 'released')),
  ADD COLUMN IF NOT EXISTS remittance_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS remittance_confirmed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cod'
    CHECK (payment_method IN ('cod', 'online')),
  ADD COLUMN IF NOT EXISTS wallet_status text
    CHECK (wallet_status IN ('pending_remittance', 'collected', 'released')),
  ADD COLUMN IF NOT EXISTS remittance_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS remittance_confirmed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_responses_wallet
  ON public.form_responses (organization_id, wallet_status)
  WHERE status = 'completed' AND response_type = 'order';

CREATE INDEX IF NOT EXISTS idx_customer_orders_wallet
  ON public.customer_orders (organization_id, wallet_status)
  WHERE status = 'completed';

COMMENT ON COLUMN public.form_responses.wallet_status IS
  'COD remittance state for delivered orders: pending_remittance → collected → released';
COMMENT ON COLUMN public.customer_orders.wallet_status IS
  'Mirrors form_responses wallet_status for greenfield orders';

CREATE OR REPLACE FUNCTION public.init_wallet_status_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.payment_method = 'online' THEN
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

DROP TRIGGER IF EXISTS trg_form_responses_wallet_init ON public.form_responses;
CREATE TRIGGER trg_form_responses_wallet_init
  BEFORE INSERT OR UPDATE OF status, payment_method ON public.form_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.init_wallet_status_on_delivery();

DROP TRIGGER IF EXISTS trg_customer_orders_wallet_init ON public.customer_orders;
CREATE TRIGGER trg_customer_orders_wallet_init
  BEFORE INSERT OR UPDATE OF status, payment_method ON public.customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.init_wallet_status_on_delivery();

-- Mirror wallet fields from form_responses → linked customer_order
CREATE OR REPLACE FUNCTION public.sync_wallet_to_customer_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.customer_orders co
  SET
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
CREATE TRIGGER trg_sync_wallet_form_to_customer
  AFTER UPDATE OF payment_method, wallet_status, remittance_confirmed_at,
    remittance_confirmed_by, released_at, released_by
  ON public.form_responses
  FOR EACH ROW
  WHEN (OLD.wallet_status IS DISTINCT FROM NEW.wallet_status
    OR OLD.payment_method IS DISTINCT FROM NEW.payment_method)
  EXECUTE FUNCTION public.sync_wallet_to_customer_order();

-- Backfill existing delivered orders
UPDATE public.form_responses fr
SET
  wallet_status = CASE
    WHEN fr.payment_method = 'online' THEN 'collected'
    ELSE 'pending_remittance'
  END,
  remittance_confirmed_at = CASE
    WHEN fr.payment_method = 'online' THEN COALESCE(fr.remittance_confirmed_at, fr.completed_at, NOW())
    ELSE fr.remittance_confirmed_at
  END
WHERE fr.status = 'completed'
  AND fr.response_type = 'order'
  AND fr.wallet_status IS NULL;

UPDATE public.customer_orders co
SET
  wallet_status = CASE
    WHEN co.payment_method = 'online' THEN 'collected'
    ELSE 'pending_remittance'
  END,
  remittance_confirmed_at = CASE
    WHEN co.payment_method = 'online' THEN COALESCE(co.remittance_confirmed_at, co.completed_at, NOW())
    ELSE co.remittance_confirmed_at
  END
WHERE co.status = 'completed'
  AND co.wallet_status IS NULL;
