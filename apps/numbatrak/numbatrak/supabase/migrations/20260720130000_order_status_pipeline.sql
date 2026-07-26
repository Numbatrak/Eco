-- Order status pipeline: expand enum, backfill legacy rows, treat delivered = completed in triggers

CREATE OR REPLACE FUNCTION public.is_order_delivered_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status IN ('completed', 'delivered');
$$;

COMMENT ON FUNCTION public.is_order_delivered_status IS
  'True when order counts as delivered (legacy completed or spec delivered).';

-- ---------------------------------------------------------------------------
-- Expand status CHECK on customer_orders (drop/recreate if present)
-- ---------------------------------------------------------------------------
ALTER TABLE public.customer_orders
  DROP CONSTRAINT IF EXISTS customer_orders_status_check;

ALTER TABLE public.customer_orders
  ADD CONSTRAINT customer_orders_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'new'::text,
        'confirmed'::text,
        'packed'::text,
        'dispatched'::text,
        'delivered'::text,
        'failed'::text,
        'returned'::text,
        'lost'::text,
        'pending'::text,
        'completed'::text,
        'cancelled'::text
      ]
    )
  );

-- form_responses keeps abandoned for abandoned_cart rows
ALTER TABLE public.form_responses
  DROP CONSTRAINT IF EXISTS form_responses_status_check;

ALTER TABLE public.form_responses
  ADD CONSTRAINT form_responses_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'new'::text,
        'confirmed'::text,
        'packed'::text,
        'dispatched'::text,
        'delivered'::text,
        'failed'::text,
        'returned'::text,
        'lost'::text,
        'pending'::text,
        'completed'::text,
        'cancelled'::text,
        'abandoned'::text
      ]
    )
  );

-- Backfill pipeline: pending orders → new (orders only on form_responses)
UPDATE public.customer_orders
SET status = 'new', updated_at = NOW()
WHERE status = 'pending';

UPDATE public.form_responses
SET status = 'new', updated_at = NOW()
WHERE status = 'pending'
  AND response_type = 'order';

-- ---------------------------------------------------------------------------
-- Profit triggers: delivered OR completed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extract_form_response_constants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_revenue NUMERIC;
  v_item_cost NUMERIC;
BEGIN
  NEW.phone_number := COALESCE(
    NEW.field_values->>'customer_phone',
    NEW.field_values->>'phone_number',
    NEW.field_values->>'whatsapp_number',
    NEW.field_values->>'phone'
  );
  NEW.package_name := COALESCE(
    NEW.field_values->>'package_name',
    NEW.field_values->>'selected_package',
    NEW.field_values->>'package',
    NEW.field_values->>'package_type'
  );
  NEW.customer_name := COALESCE(
    NEW.field_values->>'customer_name',
    NEW.field_values->>'name',
    CONCAT(
      COALESCE(NEW.field_values->>'first_name', ''),
      ' ',
      COALESCE(NEW.field_values->>'last_name', '')
    )
  );

  IF public.is_order_delivered_status(NEW.status) THEN
    IF NEW.id IS NOT NULL THEN
      SELECT COALESCE(SUM(total_price), 0), COALESCE(SUM(total_cost), 0)
      INTO v_item_revenue, v_item_cost
      FROM form_response_items
      WHERE form_response_id = NEW.id;
    ELSE
      v_item_revenue := 0;
      v_item_cost := 0;
    END IF;

    NEW.order_profit := public.compute_form_response_gross_profit(
      COALESCE(NEW.order_revenue, v_item_revenue),
      COALESCE(NEW.order_cost, v_item_cost)
    );
    NEW.profit := public.compute_form_response_net_profit(
      COALESCE(NEW.order_revenue, v_item_revenue),
      COALESCE(NEW.order_cost, v_item_cost),
      NEW.delivery_fee
    );

    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
  ELSIF TG_OP = 'UPDATE'
    AND public.is_order_delivered_status(OLD.status)
    AND NOT public.is_order_delivered_status(NEW.status) THEN
    NEW.profit := 0;
  ELSIF NOT public.is_order_delivered_status(NEW.status) THEN
    NEW.profit := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_form_response_profit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_response_id UUID;
  v_item_revenue NUMERIC;
  v_item_cost NUMERIC;
BEGIN
  v_response_id := COALESCE(NEW.form_response_id, OLD.form_response_id);

  SELECT COALESCE(SUM(total_price), 0), COALESCE(SUM(total_cost), 0)
  INTO v_item_revenue, v_item_cost
  FROM form_response_items
  WHERE form_response_id = v_response_id;

  UPDATE form_responses fr
  SET
    order_profit = public.compute_form_response_gross_profit(
      COALESCE(fr.order_revenue, v_item_revenue),
      COALESCE(fr.order_cost, v_item_cost)
    ),
    profit = public.compute_form_response_net_profit(
      COALESCE(fr.order_revenue, v_item_revenue),
      COALESCE(fr.order_cost, v_item_cost),
      fr.delivery_fee
    )
  WHERE fr.id = v_response_id
    AND public.is_order_delivered_status(fr.status);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- customer_orders profit on delivered (mirror form_responses net formula)
CREATE OR REPLACE FUNCTION public.set_customer_order_profit_on_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_revenue NUMERIC;
  v_item_cost NUMERIC;
BEGIN
  IF public.is_order_delivered_status(NEW.status) THEN
    SELECT COALESCE(SUM(total_price), 0), COALESCE(SUM(total_cost), 0)
    INTO v_item_revenue, v_item_cost
    FROM customer_order_items
    WHERE order_id = NEW.id;

    NEW.order_revenue := COALESCE(NEW.order_revenue, v_item_revenue);
    NEW.order_cost := COALESCE(NEW.order_cost, v_item_cost);
    NEW.profit := public.compute_form_response_net_profit(
      NEW.order_revenue,
      NEW.order_cost,
      NEW.delivery_fee
    );

    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
  ELSIF TG_OP = 'UPDATE'
    AND public.is_order_delivered_status(OLD.status)
    AND NOT public.is_order_delivered_status(NEW.status) THEN
    NEW.profit := 0;
  ELSIF NOT public.is_order_delivered_status(NEW.status) THEN
    NEW.profit := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_order_profit ON public.customer_orders;
CREATE TRIGGER trg_customer_order_profit
  BEFORE INSERT OR UPDATE OF status, delivery_fee, order_revenue, order_cost
  ON public.customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_order_profit_on_status();

-- ---------------------------------------------------------------------------
-- Wallet init on delivery (delivered + completed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.init_wallet_status_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_order_delivered_status(NEW.status)
    AND (TG_OP = 'INSERT' OR NOT public.is_order_delivered_status(OLD.status)) THEN
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
  ELSIF TG_OP = 'UPDATE'
    AND public.is_order_delivered_status(OLD.status)
    AND NOT public.is_order_delivered_status(NEW.status) THEN
    NEW.wallet_status := NULL;
    NEW.remittance_confirmed_at := NULL;
    NEW.remittance_confirmed_by := NULL;
    NEW.released_at := NULL;
    NEW.released_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP INDEX IF EXISTS idx_customer_orders_money_received;
CREATE INDEX IF NOT EXISTS idx_customer_orders_money_received
  ON public.customer_orders (organization_id, money_received_by)
  WHERE public.is_order_delivered_status(status);
