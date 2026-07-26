


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_missing_user_profiles"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  -- Create user_profiles for users in organization_members but not in user_profiles
  FOR v_user IN
    SELECT DISTINCT om.user_id, au.email
    FROM organization_members om
    JOIN auth.users au ON au.id = om.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM user_profiles up WHERE up.id = om.user_id
    )
  LOOP
    -- Check if email_verified column exists before inserting
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_profiles' 
      AND column_name = 'email_verified'
    ) THEN
      INSERT INTO user_profiles (id, email, full_name, role, email_verified)
      VALUES (
        v_user.user_id,
        COALESCE(v_user.email, ''),
        COALESCE(v_user.email, 'Unknown User'),
        'Customer Relations',
        FALSE
      )
      ON CONFLICT (id) DO UPDATE
      SET 
        email = COALESCE(EXCLUDED.email, user_profiles.email),
        full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
        updated_at = NOW();
    ELSE
      INSERT INTO user_profiles (id, email, full_name, role)
      VALUES (
        v_user.user_id,
        COALESCE(v_user.email, ''),
        COALESCE(v_user.email, 'Unknown User'),
        'Customer Relations'
      )
      ON CONFLICT (id) DO UPDATE
      SET 
        email = COALESCE(EXCLUDED.email, user_profiles.email),
        full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
        updated_at = NOW();
    END IF;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."create_missing_user_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_organization_invitation"("inv_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inv public.organization_invitations%ROWTYPE;
  v_user_id uuid;
  v_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'User email not found');
  END IF;

  SELECT * INTO v_inv
  FROM public.organization_invitations
  WHERE invitation_code = inv_code
    AND accepted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or already used invitation');
  END IF;

  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  IF v_inv.email <> v_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation was sent to a different email address');
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_inv.organization_id, v_user_id, v_inv.role)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, updated_at = now();

  UPDATE public.organization_invitations
  SET accepted_at = now(), accepted_by = v_user_id, updated_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_inv.organization_id,
    'role', v_inv.role
  );
END;
$$;


ALTER FUNCTION "public"."accept_organization_invitation"("inv_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_form_response_gross_profit"("p_order_revenue" numeric, "p_order_cost" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT COALESCE(p_order_revenue, 0) - COALESCE(p_order_cost, 0);
$$;


ALTER FUNCTION "public"."compute_form_response_gross_profit"("p_order_revenue" numeric, "p_order_cost" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_form_response_net_profit"("p_order_revenue" numeric, "p_order_cost" numeric, "p_delivery_fee" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT COALESCE(p_order_revenue, 0)
       - COALESCE(p_order_cost, 0)
       - COALESCE(p_delivery_fee, 0);
$$;


ALTER FUNCTION "public"."compute_form_response_net_profit"("p_order_revenue" numeric, "p_order_cost" numeric, "p_delivery_fee" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_from_normalized_submission"("p_organization_id" "uuid", "p_form_id" "uuid", "p_source" "text" DEFAULT 'wordpress'::"text", "p_page_url" "text" DEFAULT NULL::"text", "p_field_values" "jsonb" DEFAULT '{}'::"jsonb", "p_items" "jsonb" DEFAULT '[]'::"jsonb", "p_raw_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_normalized_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_package" "text" DEFAULT NULL::"text", "p_offer_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_response_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INT;
  v_remaining INT;
  v_lot RECORD;
  v_consumed INT;
  v_line_total_cost NUMERIC(12,2);
  v_unit_price NUMERIC(12,2);
  v_cost_price NUMERIC(12,2);
  v_item_id UUID;
  v_order_total_cost NUMERIC(12,2) := 0;
  v_order_total_revenue NUMERIC(12,2) := 0;
  v_unit_cost_avg NUMERIC(12,2);
  v_lot_ids UUID[] := '{}';
  v_qtys INT[] := '{}';
  v_costs NUMERIC[] := '{}';
  v_i INT;
  v_has_lots BOOLEAN;
BEGIN
  INSERT INTO form_responses (
    organization_id, form_id, response_type, status, source, page_url,
    field_values, selected_products, raw_payload, normalized_payload, items,
    package, offer_name, submitted_at, submission_status
  )
  VALUES (
    p_organization_id, p_form_id, 'order', 'pending', p_source, p_page_url,
    p_field_values, p_items, p_raw_payload, p_normalized_payload, p_items,
    p_package, p_offer_name, NOW(), 'raw_submission'
  )
  RETURNING id INTO v_response_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_lot_ids := '{}'; v_qtys := '{}'; v_costs := '{}';
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_product_id;
    END IF;

    SELECT COALESCE(
      (SELECT price FROM product_price_history WHERE product_id = v_product_id AND ends_at IS NULL ORDER BY starts_at DESC LIMIT 1),
      (SELECT base_price FROM products WHERE id = v_product_id)
    ) INTO v_unit_price;
    SELECT COALESCE(
      (SELECT cost_price FROM product_price_history WHERE product_id = v_product_id AND ends_at IS NULL ORDER BY starts_at DESC LIMIT 1),
      (SELECT cost_price FROM products WHERE id = v_product_id)
    ) INTO v_cost_price;
    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'No price for product %', v_product_id;
    END IF;

    SELECT (COALESCE(SUM(quantity_remaining), 0) > 0) INTO v_has_lots
    FROM inventory_lots
    WHERE organization_id = p_organization_id AND product_id = v_product_id;

    IF NOT v_has_lots THEN
      v_line_total_cost := COALESCE(v_cost_price, 0) * v_quantity;
      INSERT INTO form_response_items (
        form_response_id, product_id, quantity,
        unit_price_at_submission, unit_cost_at_submission, total_price, total_cost, profit
      )
      VALUES (
        v_response_id, v_product_id, v_quantity,
        v_unit_price, COALESCE(v_cost_price, 0),
        v_unit_price * v_quantity, v_line_total_cost,
        (v_unit_price * v_quantity) - v_line_total_cost
      );
      v_order_total_cost := v_order_total_cost + v_line_total_cost;
      v_order_total_revenue := v_order_total_revenue + (v_unit_price * v_quantity);
      CONTINUE;
    END IF;

    v_remaining := v_quantity;
    v_line_total_cost := 0;

    FOR v_lot IN
      SELECT id, quantity_remaining, unit_cost
      FROM inventory_lots
      WHERE organization_id = p_organization_id AND product_id = v_product_id AND quantity_remaining > 0
      ORDER BY received_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_consumed := LEAST(v_remaining, v_lot.quantity_remaining);
      IF v_consumed <= 0 THEN EXIT; END IF;

      v_line_total_cost := v_line_total_cost + (v_consumed * v_lot.unit_cost);
      v_remaining := v_remaining - v_consumed;
      v_lot_ids := array_append(v_lot_ids, v_lot.id);
      v_qtys := array_append(v_qtys, v_consumed);
      v_costs := array_append(v_costs, v_lot.unit_cost);

      UPDATE inventory_lots
      SET quantity_remaining = quantity_remaining - v_consumed, updated_at = NOW()
      WHERE id = v_lot.id;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient inventory for product % (need %, short %)', v_product_id, v_quantity, v_remaining;
    END IF;

    v_unit_cost_avg := v_line_total_cost / NULLIF(v_quantity, 0);
    INSERT INTO form_response_items (
      form_response_id, product_id, quantity,
      unit_price_at_submission, unit_cost_at_submission, total_price, total_cost, profit
    )
    VALUES (
      v_response_id, v_product_id, v_quantity,
      v_unit_price, v_unit_cost_avg,
      v_unit_price * v_quantity, v_line_total_cost,
      (v_unit_price * v_quantity) - v_line_total_cost
    )
    RETURNING id INTO v_item_id;

    FOR v_i IN 1..array_length(v_lot_ids, 1)
    LOOP
      INSERT INTO order_inventory_consumption (
        organization_id, order_id, order_item_id, inventory_lot_id, quantity_consumed, unit_cost
      )
      VALUES (
        p_organization_id, v_response_id, v_item_id, v_lot_ids[v_i], v_qtys[v_i], v_costs[v_i]
      );
    END LOOP;

    v_order_total_cost := v_order_total_cost + v_line_total_cost;
    v_order_total_revenue := v_order_total_revenue + (v_unit_price * v_quantity);
  END LOOP;

  UPDATE form_responses
  SET
    order_cost = v_order_total_cost,
    order_revenue = v_order_total_revenue,
    order_profit = public.compute_form_response_gross_profit(
      v_order_total_revenue,
      v_order_total_cost
    ),
    submission_status = 'order_created',
    status = 'pending',
    completed_at = NULL,
    updated_at = NOW()
  WHERE id = v_response_id;

  RETURN jsonb_build_object(
    'id', v_response_id,
    'order_cost', v_order_total_cost,
    'order_revenue', v_order_total_revenue,
    'order_profit', public.compute_form_response_gross_profit(
      v_order_total_revenue,
      v_order_total_cost
    )
  );
END;
$$;


ALTER FUNCTION "public"."create_order_from_normalized_submission"("p_organization_id" "uuid", "p_form_id" "uuid", "p_source" "text", "p_page_url" "text", "p_field_values" "jsonb", "p_items" "jsonb", "p_raw_payload" "jsonb", "p_normalized_payload" "jsonb", "p_package" "text", "p_offer_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_organization_with_owner"("p_name" "text") RETURNS TABLE("id" "uuid", "name" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  -- Ensure the function can insert even when RLS policies are strict/complex.
  -- The function itself is SECURITY DEFINER and is intended for organization creation.
  SET row_security = off;

  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Create the organization
  INSERT INTO organizations (name)
  VALUES (p_name)
  RETURNING organizations.id INTO v_org_id;
  
  -- Add creator as Owner
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'Owner');
  
  -- Return the created organization
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.created_at,
    o.updated_at
  FROM organizations o
  WHERE o.id = v_org_id;
END;
$$;


ALTER FUNCTION "public"."create_organization_with_owner"("p_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_organization_with_owner"("p_name" "text") IS 'Creates a new organization and adds the creator as Owner. Bypasses RLS to ensure atomic creation.';



CREATE OR REPLACE FUNCTION "public"."create_verification_otp"("p_email" "text", "p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN public.create_verification_otp_uuid_text(p_user_id, p_email);
END;
$$;


ALTER FUNCTION "public"."create_verification_otp"("p_email" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_verification_otp_uuid_text"("p_user_id" "uuid", "p_email" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_otp_code TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Ensure the referenced user_profiles row exists to satisfy the FK
  -- email_verification_otps(user_id) -> user_profiles(id).
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (p_user_id, p_email, p_email, 'Customer Relations')
  ON CONFLICT (id) DO NOTHING;

  -- Generate 6-digit OTP
  v_otp_code := generate_otp();
  v_expires_at := NOW() + INTERVAL '15 minutes';
  
  -- Insert or update OTP
  INSERT INTO email_verification_otps (user_id, email, otp_code, expires_at)
  VALUES (p_user_id, p_email, v_otp_code, v_expires_at)
  ON CONFLICT (user_id, email) DO UPDATE
  SET 
    otp_code = EXCLUDED.otp_code,
    expires_at = EXCLUDED.expires_at,
    verified_at = NULL;
  
  RETURN v_otp_code;
END;
$$;


ALTER FUNCTION "public"."create_verification_otp_uuid_text"("p_user_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_form_response_constants"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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
  IF NEW.status = 'completed' THEN
    IF NEW.id IS NOT NULL THEN
      SELECT COALESCE(SUM(total_price), 0), COALESCE(SUM(total_cost), 0)
      INTO v_item_revenue, v_item_cost
      FROM form_response_items WHERE form_response_id = NEW.id;
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
  ELSE
    NEW.profit := 0;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."extract_form_response_constants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_otp"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$;


ALTER FUNCTION "public"."generate_otp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_org_role"("org_id" "uuid") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT role FROM organization_members 
  WHERE organization_id = org_id AND user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_org_role"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_organizations"() RETURNS TABLE("organization_id" "uuid", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  RETURN QUERY
  SELECT om.organization_id, om.role
  FROM public.organization_members om
  WHERE om.user_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."get_user_organizations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_has_email_verified BOOLEAN;
BEGIN
  -- Check if email_verified column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'email_verified'
  ) INTO v_has_email_verified;
  
  IF v_has_email_verified THEN
    INSERT INTO public.user_profiles (id, email, full_name, role, email_verified)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'Customer Relations',
      COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
      email_verified = COALESCE(EXCLUDED.email_verified, user_profiles.email_verified, FALSE),
      updated_at = NOW();
  ELSE
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'Customer Relations'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_email_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.user_profiles
    SET 
      email = NEW.email,
      updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_email_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_any_org_role"("org_id" "uuid", "required_roles" "text"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = org_id 
    AND user_id = auth.uid() 
    AND role = ANY(required_roles)
  );
END;
$$;


ALTER FUNCTION "public"."has_any_org_role"("org_id" "uuid", "required_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_org_role"("org_id" "uuid", "required_role" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = org_id 
    AND user_id = auth.uid() 
    AND role = required_role
  );
END;
$$;


ALTER FUNCTION "public"."has_org_role"("org_id" "uuid", "required_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_member"("org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_org_member"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_csr_user_id"("p_organization_id" "uuid", "p_raw" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT a.user_id
  FROM public.csr_name_aliases a
  WHERE a.organization_id = p_organization_id
    AND lower(trim(p_raw)) LIKE '%' || lower(trim(a.match_pattern)) || '%'
  ORDER BY length(a.match_pattern) DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."resolve_csr_user_id"("p_organization_id" "uuid", "p_raw" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolve_csr_user_id"("p_organization_id" "uuid", "p_raw" "text") IS 'Best-effort match; prefer exact aliases in csr_name_aliases.';



CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_follow_up_organization_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.order_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM public.orders WHERE id = NEW.order_id;
  ELSIF NEW.abandoned_cart_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM public.abandoned_carts WHERE id = NEW.abandoned_cart_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_follow_up_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_invitation_defaults"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.invitation_code IS NULL OR btrim(NEW.invitation_code) = '' THEN
    NEW.invitation_code := encode(gen_random_bytes(16), 'hex');
  END IF;
  NEW.email := lower(btrim(NEW.email));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_invitation_defaults"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_customer_orders"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."set_updated_at_customer_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_form_response_profit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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
    AND fr.status = 'completed';

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_form_response_profit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_otp"("p_otp_code" "text", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN public.verify_otp_uuid_text(p_user_id, p_otp_code);
END;
$$;


ALTER FUNCTION "public"."verify_otp"("p_otp_code" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_otp_uuid_text"("p_user_id" "uuid", "p_otp_code" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_otp_record RECORD;
BEGIN
  -- Find valid OTP
  SELECT * INTO v_otp_record
  FROM email_verification_otps
  WHERE user_id = p_user_id
    AND otp_code = p_otp_code
    AND expires_at > NOW()
    AND verified_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Mark as verified
  UPDATE email_verification_otps
  SET verified_at = NOW()
  WHERE id = v_otp_record.id;
  
  -- Update user profile
  UPDATE user_profiles
  SET 
    email_verified = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."verify_otp_uuid_text"("p_user_id" "uuid", "p_otp_code" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."abandoned_carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "form_id" "uuid",
    "page_url" "text",
    "filled_fields" "jsonb",
    "field_values" "jsonb",
    "selected_products" "jsonb",
    "converted_to_order" boolean DEFAULT false,
    "converted_order_id" "uuid",
    "abandoned_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "customer_name" "text",
    "phone_number" "text",
    "whatsapp_number" "text",
    "delivery_address" "text",
    "state" "text",
    "location" "text",
    "selected_package" "text",
    "selected_items" "text",
    "product_name" "text",
    "mail_quan" integer,
    "agent_quan" integer,
    "quantity" integer,
    "product2" "text",
    "mail_quan2" integer,
    "agent_quan2" integer,
    "quantity2" integer,
    "filled_fields_count" integer DEFAULT 0,
    "note" "text",
    "subject" "text",
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "order_month" "text",
    "order_year" "text",
    "cost_price" numeric(10,2),
    "delivery_fee" numeric(10,2),
    "profit" numeric(10,2),
    "order_status" "text" DEFAULT 'Pending'::"text",
    "delivery_date" "date",
    "delivery_month" "text",
    "delivery_year" "text",
    "confirmed_delivery" boolean DEFAULT false,
    "agent_name" "text",
    "sales_price" numeric(10,2)
);


ALTER TABLE "public"."abandoned_carts" OWNER TO "postgres";


COMMENT ON TABLE "public"."abandoned_carts" IS 'Stores abandoned cart data from WordPress Fluent Forms';



CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" bigint NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_name" "text",
    "action_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" bigint,
    "description" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


ALTER TABLE "public"."activities" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."activities_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."agent_expenses" (
    "id" bigint NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "category" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "agent_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_expenses_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."agent_expenses" OWNER TO "postgres";


ALTER TABLE "public"."agent_expenses" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."agent_expenses_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "movement_type" "text" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "from_agent_id" bigint,
    "to_agent_id" bigint,
    "order_id" "uuid",
    "waybill_batch_id" "uuid",
    "legacy_delivery_id" bigint,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cost" numeric(14,2) DEFAULT 0,
    "fee" numeric(14,2) DEFAULT 0,
    "recorded_by_user_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "stock_movements_agents_chk" CHECK (((("movement_type" = 'waybill_to_agent'::"text") AND ("to_agent_id" IS NOT NULL)) OR (("movement_type" = 'deliver_to_customer'::"text") AND ("from_agent_id" IS NOT NULL)) OR (("movement_type" = 'return_to_lagos'::"text") AND ("from_agent_id" IS NOT NULL)) OR (("movement_type" = 'transfer'::"text") AND ("from_agent_id" IS NOT NULL) AND ("to_agent_id" IS NOT NULL)) OR (("movement_type" = 'adjust'::"text") AND (("from_agent_id" IS NOT NULL) OR ("to_agent_id" IS NOT NULL))))),
    CONSTRAINT "stock_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['waybill_to_agent'::"text", 'deliver_to_customer'::"text", 'return_to_lagos'::"text", 'transfer'::"text", 'adjust'::"text"])))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."agent_stock_breakdown_v" AS
 WITH "w" AS (
         SELECT "stock_movements"."organization_id",
            "stock_movements"."to_agent_id" AS "agent_id",
            "stock_movements"."product_id",
            ("sum"("stock_movements"."quantity"))::numeric AS "waybilled_in"
           FROM "public"."stock_movements"
          WHERE (("stock_movements"."movement_type" = 'waybill_to_agent'::"text") AND ("stock_movements"."to_agent_id" IS NOT NULL))
          GROUP BY "stock_movements"."organization_id", "stock_movements"."to_agent_id", "stock_movements"."product_id"
        ), "d" AS (
         SELECT "stock_movements"."organization_id",
            "stock_movements"."from_agent_id" AS "agent_id",
            "stock_movements"."product_id",
            ("sum"("stock_movements"."quantity"))::numeric AS "delivered_out"
           FROM "public"."stock_movements"
          WHERE (("stock_movements"."movement_type" = 'deliver_to_customer'::"text") AND ("stock_movements"."from_agent_id" IS NOT NULL))
          GROUP BY "stock_movements"."organization_id", "stock_movements"."from_agent_id", "stock_movements"."product_id"
        ), "keys" AS (
         SELECT "w_1"."organization_id",
            "w_1"."agent_id",
            "w_1"."product_id"
           FROM "w" "w_1"
        UNION
         SELECT "d_1"."organization_id",
            "d_1"."agent_id",
            "d_1"."product_id"
           FROM "d" "d_1"
        )
 SELECT "k"."organization_id",
    "k"."agent_id",
    "k"."product_id",
    COALESCE("w"."waybilled_in", (0)::numeric) AS "waybilled_in",
    COALESCE("d"."delivered_out", (0)::numeric) AS "delivered_to_customer",
    (COALESCE("w"."waybilled_in", (0)::numeric) - COALESCE("d"."delivered_out", (0)::numeric)) AS "approx_remaining"
   FROM (("keys" "k"
     LEFT JOIN "w" ON ((("w"."organization_id" = "k"."organization_id") AND ("w"."agent_id" = "k"."agent_id") AND ("w"."product_id" = "k"."product_id"))))
     LEFT JOIN "d" ON ((("d"."organization_id" = "k"."organization_id") AND ("d"."agent_id" = "k"."agent_id") AND ("d"."product_id" = "k"."product_id"))));


ALTER VIEW "public"."agent_stock_breakdown_v" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."agent_stock_v" AS
 SELECT "organization_id",
    "agent_id",
    "product_id",
    "sum"("delta") AS "quantity_on_hand"
   FROM ( SELECT "stock_movements"."organization_id",
            "stock_movements"."to_agent_id" AS "agent_id",
            "stock_movements"."product_id",
            ("stock_movements"."quantity")::numeric AS "delta"
           FROM "public"."stock_movements"
          WHERE (("stock_movements"."movement_type" = 'waybill_to_agent'::"text") AND ("stock_movements"."to_agent_id" IS NOT NULL))
        UNION ALL
         SELECT "stock_movements"."organization_id",
            "stock_movements"."from_agent_id",
            "stock_movements"."product_id",
            (- ("stock_movements"."quantity")::numeric)
           FROM "public"."stock_movements"
          WHERE (("stock_movements"."movement_type" = 'deliver_to_customer'::"text") AND ("stock_movements"."from_agent_id" IS NOT NULL))
        UNION ALL
         SELECT "stock_movements"."organization_id",
            "stock_movements"."from_agent_id",
            "stock_movements"."product_id",
            (- ("stock_movements"."quantity")::numeric)
           FROM "public"."stock_movements"
          WHERE (("stock_movements"."movement_type" = 'return_to_lagos'::"text") AND ("stock_movements"."from_agent_id" IS NOT NULL))
        UNION ALL
         SELECT "stock_movements"."organization_id",
            "stock_movements"."to_agent_id",
            "stock_movements"."product_id",
            ("stock_movements"."quantity")::numeric AS "quantity"
           FROM "public"."stock_movements"
          WHERE (("stock_movements"."movement_type" = 'transfer'::"text") AND ("stock_movements"."to_agent_id" IS NOT NULL))
        UNION ALL
         SELECT "stock_movements"."organization_id",
            "stock_movements"."from_agent_id",
            "stock_movements"."product_id",
            (- ("stock_movements"."quantity")::numeric)
           FROM "public"."stock_movements"
          WHERE (("stock_movements"."movement_type" = 'transfer'::"text") AND ("stock_movements"."from_agent_id" IS NOT NULL))
        UNION ALL
         SELECT "stock_movements"."organization_id",
            COALESCE("stock_movements"."from_agent_id", "stock_movements"."to_agent_id") AS "agent_id",
            "stock_movements"."product_id",
            ("stock_movements"."quantity")::numeric AS "quantity"
           FROM "public"."stock_movements"
          WHERE (("stock_movements"."movement_type" = 'adjust'::"text") AND (("stock_movements"."from_agent_id" IS NOT NULL) OR ("stock_movements"."to_agent_id" IS NOT NULL)))) "t"
  GROUP BY "organization_id", "agent_id", "product_id";


ALTER VIEW "public"."agent_stock_v" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" bigint NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "locations" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "state" "text"
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agents"."state" IS 'Primary state/region for reporting; locations may list multiple areas';



ALTER TABLE "public"."agents" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."agents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."csr_name_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "match_pattern" "text" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."csr_name_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price_at_submission" numeric(14,2) DEFAULT 0 NOT NULL,
    "unit_cost_at_submission" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_price" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_cost" numeric(14,2) DEFAULT 0 NOT NULL,
    "profit" numeric(14,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."customer_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "form_response_id" "uuid",
    "form_id" "uuid",
    "csr_id" "uuid",
    "agent_id" bigint,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "source" "text" DEFAULT 'form'::"text" NOT NULL,
    "customer_name" "text",
    "phone_number" "text",
    "state" "text",
    "delivery_address" "text",
    "order_revenue" numeric(14,2),
    "order_cost" numeric(14,2),
    "amount_paid" numeric(14,2),
    "delivery_fee" numeric(14,2),
    "profit" numeric(14,2),
    "notes" "text",
    "abandoned_cart_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "customer_orders_source_check" CHECK (("source" = ANY (ARRAY['form'::"text", 'manual'::"text", 'converted_from_cart'::"text"]))),
    CONSTRAINT "customer_orders_status_check" CHECK (("status" = ANY (ARRAY['abandoned'::"text", 'pending'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."customer_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliveries" (
    "id" bigint NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "csr" "text",
    "agent_id" bigint,
    "status" "text" NOT NULL,
    "product_id" bigint NOT NULL,
    "quantity" integer NOT NULL,
    "cost" numeric(14,2) NOT NULL,
    "waybilling_fee" numeric(14,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "deliveries_cost_check" CHECK (("cost" >= (0)::numeric)),
    CONSTRAINT "deliveries_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "deliveries_status_check" CHECK (("status" = ANY (ARRAY['Waybilled'::"text", 'Delivered'::"text"]))),
    CONSTRAINT "deliveries_waybilling_fee_check" CHECK (("waybilling_fee" >= (0)::numeric))
);


ALTER TABLE "public"."deliveries" OWNER TO "postgres";


ALTER TABLE "public"."deliveries" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."deliveries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."email_verification_otps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "otp_code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_verification_otps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."field_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."field_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_incentives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "trigger_condition" "jsonb",
    "auto_apply" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."form_incentives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "min_quantity" integer DEFAULT 1,
    "max_quantity" integer,
    "required" boolean DEFAULT false,
    "pricing_mode" "text" DEFAULT 'fixed'::"text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "form_products_pricing_mode_check" CHECK (("pricing_mode" = ANY (ARRAY['fixed'::"text", 'selectable'::"text"])))
);


ALTER TABLE "public"."form_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_response_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_response_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price_at_submission" numeric(10,2) NOT NULL,
    "unit_cost_at_submission" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "total_cost" numeric(10,2) NOT NULL,
    "profit" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_profit_calculation" CHECK (("profit" = ("total_price" - "total_cost"))),
    CONSTRAINT "check_total_cost_calculation" CHECK (("total_cost" = (("quantity")::numeric * "unit_cost_at_submission"))),
    CONSTRAINT "check_total_price_calculation" CHECK (("total_price" = (("quantity")::numeric * "unit_price_at_submission")))
);


ALTER TABLE "public"."form_response_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "form_id" "uuid",
    "response_type" "text" DEFAULT 'order'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "source" "text" DEFAULT 'wordpress'::"text" NOT NULL,
    "page_url" "text",
    "field_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "selected_products" "jsonb" DEFAULT '[]'::"jsonb",
    "phone_number" "text",
    "package_name" "text",
    "customer_name" "text",
    "profit" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "converted_from_abandoned" boolean DEFAULT false,
    "converted_response_id" "uuid",
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "normalized_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "package" "text",
    "offer_name" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "submission_status" "text",
    "order_cost" numeric(12,2),
    "order_revenue" numeric(12,2),
    "order_profit" numeric(12,2),
    "notes" "text",
    "delivery_fee" numeric(12,2),
    "amount_paid" numeric(12,2),
    "agent_id" "uuid",
    "csr_id" "uuid",
    CONSTRAINT "form_responses_response_type_check" CHECK (("response_type" = ANY (ARRAY['order'::"text", 'abandoned_cart'::"text"]))),
    CONSTRAINT "form_responses_status_check" CHECK (("status" = ANY (ARRAY['abandoned'::"text", 'pending'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."form_responses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."form_responses"."csr_id" IS 'Customer success rep; mirrors customer_orders.csr_id when synced';



CREATE TABLE IF NOT EXISTS "public"."forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "form_token" "text" NOT NULL,
    "schema" "jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "site_url" "text",
    "field_mapping" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."forms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follow_ups" (
    "id" bigint NOT NULL,
    "organization_id" "uuid",
    "order_id" "uuid",
    "abandoned_cart_id" "uuid",
    "assigned_to" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "first_contact_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "response_time_minutes" integer,
    "resolution_time_minutes" integer,
    "outcome" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "follow_ups_outcome_check" CHECK ((("outcome" IS NULL) OR ("outcome" = ANY (ARRAY['converted'::"text", 'not_interested'::"text", 'follow_up_needed'::"text", 'resolved'::"text", 'other'::"text"])))),
    CONSTRAINT "follow_ups_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "follow_ups_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."follow_ups" OWNER TO "postgres";


ALTER TABLE "public"."follow_ups" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."follow_ups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" bigint NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "agent_id" bigint,
    "product_id" "uuid" NOT NULL,
    "total_quantity" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_total_quantity_check" CHECK (("total_quantity" >= 0))
);


ALTER TABLE "public"."inventory" OWNER TO "postgres";


ALTER TABLE "public"."inventory" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_lots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity_remaining" integer NOT NULL,
    "unit_cost" numeric(12,2) NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_lots_quantity_remaining_check" CHECK (("quantity_remaining" >= 0))
);


ALTER TABLE "public"."inventory_lots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_summary" (
    "id" bigint NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "waybilled" numeric(14,2) DEFAULT 0 NOT NULL,
    "delivered" numeric(14,2) DEFAULT 0 NOT NULL,
    "balance" numeric(14,2) DEFAULT 0 NOT NULL,
    "waybill_fee" numeric(14,2) DEFAULT 0 NOT NULL,
    "expenses_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "monthly_summary_month_check" CHECK ((("month" >= 1) AND ("month" <= 12))),
    CONSTRAINT "monthly_summary_year_check" CHECK (("year" >= 2000))
);


ALTER TABLE "public"."monthly_summary" OWNER TO "postgres";


ALTER TABLE "public"."monthly_summary" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."monthly_summary_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_assignment_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "assignment_method" "text" DEFAULT 'round_robin'::"text" NOT NULL,
    "last_assigned_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_assignment_settings_assignment_method_check" CHECK (("assignment_method" = ANY (ARRAY['round_robin'::"text", 'percentage'::"text"])))
);


ALTER TABLE "public"."order_assignment_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_assignment_weights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "percentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "is_paused" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_assignment_weights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_inventory_consumption" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "inventory_lot_id" "uuid" NOT NULL,
    "quantity_consumed" integer NOT NULL,
    "unit_cost" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_inventory_consumption_quantity_consumed_check" CHECK (("quantity_consumed" > 0))
);


ALTER TABLE "public"."order_inventory_consumption" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price_at_order" numeric(10,2) NOT NULL,
    "unit_cost_at_order" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "total_cost" numeric(10,2) NOT NULL,
    "profit" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_profit_calculation" CHECK (("profit" = ("total_price" - "total_cost"))),
    CONSTRAINT "check_total_cost_calculation" CHECK (("total_cost" = (("quantity")::numeric * "unit_cost_at_order"))),
    CONSTRAINT "check_total_price_calculation" CHECK (("total_price" = (("quantity")::numeric * "unit_price_at_order")))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'wordpress'::"text" NOT NULL,
    "status" "text" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'Customer Relations'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['Owner'::"text", 'Admin'::"text", 'Customer Relations'::"text", 'Manager'::"text"])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "invitation_code" "text" NOT NULL,
    "role" "text" DEFAULT 'Customer Relations'::"text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "accepted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_invitations_role_check" CHECK (("role" = ANY (ARRAY['Owner'::"text", 'Admin'::"text", 'Customer Relations'::"text", 'Manager'::"text"])))
);


ALTER TABLE "public"."organization_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "cost_price" numeric(10,2) NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_price_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "type" "text" DEFAULT 'NORMAL'::"text" NOT NULL,
    "base_price" numeric(10,2) NOT NULL,
    "cost_price" numeric(10,2) NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "products_type_check" CHECK (("type" = ANY (ARRAY['NORMAL'::"text", 'INCENTIVE'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unified_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "scope" "text" NOT NULL,
    "category" "text" NOT NULL,
    "subcategory" "text" DEFAULT ''::"text",
    "amount" numeric(14,2) NOT NULL,
    "agent_id" bigint,
    "product_id" "uuid",
    "order_id" "uuid",
    "note" "text",
    "occurred_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_by" "uuid",
    "legacy_agent_expense_id" bigint,
    "legacy_general_expense_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "unified_expenses_scope_check" CHECK (("scope" = ANY (ARRAY['org'::"text", 'agent'::"text"])))
);


ALTER TABLE "public"."unified_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'Customer Relations'::"text" NOT NULL,
    "email_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "otp_code" "text",
    "otp_expires_at" timestamp with time zone,
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['Owner'::"text", 'Admin'::"text", 'Customer Relations'::"text", 'Manager'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_monthly_delivery_summary" AS
 SELECT "organization_id",
    (EXTRACT(year FROM "date"))::integer AS "year",
    (EXTRACT(month FROM "date"))::integer AS "month",
    ("sum"(
        CASE
            WHEN ("status" = 'Waybilled'::"text") THEN "cost"
            ELSE (0)::numeric
        END))::numeric(14,2) AS "waybilled",
    ("sum"(
        CASE
            WHEN ("status" = 'Delivered'::"text") THEN "cost"
            ELSE (0)::numeric
        END))::numeric(14,2) AS "delivered",
    (("sum"(
        CASE
            WHEN ("status" = 'Waybilled'::"text") THEN "cost"
            ELSE (0)::numeric
        END) - "sum"(
        CASE
            WHEN ("status" = 'Delivered'::"text") THEN "cost"
            ELSE (0)::numeric
        END)))::numeric(14,2) AS "balance",
    ("sum"(
        CASE
            WHEN ("status" = 'Waybilled'::"text") THEN "waybilling_fee"
            ELSE (0)::numeric
        END))::numeric(14,2) AS "waybill_fee"
   FROM "public"."deliveries" "d"
  GROUP BY "organization_id", (EXTRACT(year FROM "date")), (EXTRACT(month FROM "date"));


ALTER VIEW "public"."v_monthly_delivery_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waybills" (
    "id" bigint NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "delivery_id" bigint,
    "waybill_number" "text" NOT NULL,
    "order_reference" "text",
    "destination" "text",
    "eta" timestamp with time zone,
    "dispatched_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "status" "text" DEFAULT 'on-time'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "waybills_status_check" CHECK (("status" = ANY (ARRAY['on-time'::"text", 'at-risk'::"text", 'delayed'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."waybills" OWNER TO "postgres";


ALTER TABLE "public"."waybills" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."waybills_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."abandoned_carts"
    ADD CONSTRAINT "abandoned_carts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_expenses"
    ADD CONSTRAINT "agent_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."csr_name_aliases"
    ADD CONSTRAINT "csr_name_aliases_organization_id_match_pattern_key" UNIQUE ("organization_id", "match_pattern");



ALTER TABLE ONLY "public"."csr_name_aliases"
    ADD CONSTRAINT "csr_name_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_order_items"
    ADD CONSTRAINT "customer_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_orders"
    ADD CONSTRAINT "customer_orders_form_response_id_key" UNIQUE ("form_response_id");



ALTER TABLE ONLY "public"."customer_orders"
    ADD CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_verification_otps"
    ADD CONSTRAINT "email_verification_otps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_verification_otps"
    ADD CONSTRAINT "email_verification_otps_user_id_email_key" UNIQUE ("user_id", "email");



ALTER TABLE ONLY "public"."field_mappings"
    ADD CONSTRAINT "field_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_incentives"
    ADD CONSTRAINT "form_incentives_form_id_product_id_key" UNIQUE ("form_id", "product_id");



ALTER TABLE ONLY "public"."form_incentives"
    ADD CONSTRAINT "form_incentives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_products"
    ADD CONSTRAINT "form_products_form_id_product_id_key" UNIQUE ("form_id", "product_id");



ALTER TABLE ONLY "public"."form_products"
    ADD CONSTRAINT "form_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_response_items"
    ADD CONSTRAINT "form_response_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_form_token_key" UNIQUE ("form_token");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_agent_id_product_id_organization_id_key" UNIQUE ("agent_id", "product_id", "organization_id");



ALTER TABLE ONLY "public"."inventory_lots"
    ADD CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_summary"
    ADD CONSTRAINT "monthly_summary_organization_id_year_month_key" UNIQUE ("organization_id", "year", "month");



ALTER TABLE ONLY "public"."monthly_summary"
    ADD CONSTRAINT "monthly_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_assignment_settings"
    ADD CONSTRAINT "order_assignment_settings_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."order_assignment_settings"
    ADD CONSTRAINT "order_assignment_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_assignment_weights"
    ADD CONSTRAINT "order_assignment_weights_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."order_assignment_weights"
    ADD CONSTRAINT "order_assignment_weights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_inventory_consumption"
    ADD CONSTRAINT "order_inventory_consumption_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "organization_invitations_code_key" ON "public"."organization_invitations" USING "btree" ("invitation_code");



CREATE UNIQUE INDEX "unique_pending_invitation" ON "public"."organization_invitations" USING "btree" ("organization_id", "lower"("email")) WHERE ("accepted_at" IS NULL);



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_price_history"
    ADD CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unified_expenses"
    ADD CONSTRAINT "unified_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waybills"
    ADD CONSTRAINT "waybills_organization_id_waybill_number_key" UNIQUE ("organization_id", "waybill_number");



ALTER TABLE ONLY "public"."waybills"
    ADD CONSTRAINT "waybills_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_abandoned_carts_abandoned_at" ON "public"."abandoned_carts" USING "btree" ("abandoned_at");



CREATE INDEX "idx_abandoned_carts_converted" ON "public"."abandoned_carts" USING "btree" ("converted_to_order");



CREATE INDEX "idx_abandoned_carts_customer_name" ON "public"."abandoned_carts" USING "btree" ("customer_name");



CREATE INDEX "idx_abandoned_carts_form_id" ON "public"."abandoned_carts" USING "btree" ("form_id");



CREATE INDEX "idx_abandoned_carts_organization_id" ON "public"."abandoned_carts" USING "btree" ("organization_id");



CREATE INDEX "idx_activities_org_created" ON "public"."activities" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_agent_expenses_agent" ON "public"."agent_expenses" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_expenses_date" ON "public"."agent_expenses" USING "btree" ("date");



CREATE INDEX "idx_agent_expenses_org" ON "public"."agent_expenses" USING "btree" ("organization_id");



CREATE INDEX "idx_agents_name" ON "public"."agents" USING "btree" ("name");



CREATE INDEX "idx_agents_org" ON "public"."agents" USING "btree" ("organization_id");



CREATE INDEX "idx_customer_order_items_order" ON "public"."customer_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_customer_order_items_product" ON "public"."customer_order_items" USING "btree" ("product_id");



CREATE INDEX "idx_customer_orders_agent" ON "public"."customer_orders" USING "btree" ("agent_id");



CREATE INDEX "idx_customer_orders_created" ON "public"."customer_orders" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_customer_orders_csr" ON "public"."customer_orders" USING "btree" ("csr_id");



CREATE INDEX "idx_customer_orders_form" ON "public"."customer_orders" USING "btree" ("form_id");



CREATE INDEX "idx_customer_orders_form_response" ON "public"."customer_orders" USING "btree" ("form_response_id");



CREATE INDEX "idx_customer_orders_org" ON "public"."customer_orders" USING "btree" ("organization_id");



CREATE INDEX "idx_customer_orders_status" ON "public"."customer_orders" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_deliveries_agent" ON "public"."deliveries" USING "btree" ("agent_id");



CREATE INDEX "idx_deliveries_date" ON "public"."deliveries" USING "btree" ("date");



CREATE INDEX "idx_deliveries_org" ON "public"."deliveries" USING "btree" ("organization_id");



CREATE INDEX "idx_deliveries_status" ON "public"."deliveries" USING "btree" ("status");



CREATE INDEX "idx_email_verification_otps_code" ON "public"."email_verification_otps" USING "btree" ("otp_code");



CREATE INDEX "idx_email_verification_otps_email" ON "public"."email_verification_otps" USING "btree" ("email");



CREATE INDEX "idx_email_verification_otps_expires_at" ON "public"."email_verification_otps" USING "btree" ("expires_at");



CREATE INDEX "idx_email_verification_otps_user_id" ON "public"."email_verification_otps" USING "btree" ("user_id");



CREATE INDEX "idx_field_mappings_form_id" ON "public"."field_mappings" USING "btree" ("form_id");



CREATE INDEX "idx_field_mappings_organization_id" ON "public"."field_mappings" USING "btree" ("organization_id");



CREATE INDEX "idx_form_incentives_form_id" ON "public"."form_incentives" USING "btree" ("form_id");



CREATE INDEX "idx_form_incentives_product_id" ON "public"."form_incentives" USING "btree" ("product_id");



CREATE INDEX "idx_form_products_form_id" ON "public"."form_products" USING "btree" ("form_id");



CREATE INDEX "idx_form_products_product_id" ON "public"."form_products" USING "btree" ("product_id");



CREATE INDEX "idx_form_response_items_product_id" ON "public"."form_response_items" USING "btree" ("product_id");



CREATE INDEX "idx_form_response_items_response_id" ON "public"."form_response_items" USING "btree" ("form_response_id");



CREATE INDEX "idx_form_responses_completed_at" ON "public"."form_responses" USING "btree" ("completed_at");



CREATE INDEX "idx_form_responses_created_at" ON "public"."form_responses" USING "btree" ("created_at");



CREATE INDEX "idx_form_responses_csr" ON "public"."form_responses" USING "btree" ("organization_id", "csr_id") WHERE ("csr_id" IS NOT NULL);



CREATE INDEX "idx_form_responses_field_values" ON "public"."form_responses" USING "gin" ("field_values");



CREATE INDEX "idx_form_responses_form_id" ON "public"."form_responses" USING "btree" ("form_id");



CREATE INDEX "idx_form_responses_organization_id" ON "public"."form_responses" USING "btree" ("organization_id");



CREATE INDEX "idx_form_responses_package_name" ON "public"."form_responses" USING "btree" ("package_name");



CREATE INDEX "idx_form_responses_phone_number" ON "public"."form_responses" USING "btree" ("phone_number");



CREATE INDEX "idx_form_responses_profit_completed" ON "public"."form_responses" USING "btree" ("organization_id", "status") WHERE ("status" = 'completed'::"text");



CREATE INDEX "idx_form_responses_raw_payload_gin" ON "public"."form_responses" USING "gin" ("raw_payload");



CREATE INDEX "idx_form_responses_response_type" ON "public"."form_responses" USING "btree" ("response_type");



CREATE INDEX "idx_form_responses_status" ON "public"."form_responses" USING "btree" ("status");



CREATE INDEX "idx_form_responses_submission_status" ON "public"."form_responses" USING "btree" ("submission_status");



CREATE INDEX "idx_forms_active" ON "public"."forms" USING "btree" ("active");



CREATE INDEX "idx_forms_organization_id" ON "public"."forms" USING "btree" ("organization_id");



CREATE INDEX "idx_forms_token" ON "public"."forms" USING "btree" ("form_token");



CREATE INDEX "idx_follow_ups_abandoned_cart_id" ON "public"."follow_ups" USING "btree" ("abandoned_cart_id");



CREATE INDEX "idx_follow_ups_assigned_to" ON "public"."follow_ups" USING "btree" ("assigned_to");



CREATE INDEX "idx_follow_ups_created_at" ON "public"."follow_ups" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_follow_ups_order_id" ON "public"."follow_ups" USING "btree" ("order_id");



CREATE INDEX "idx_follow_ups_organization_id" ON "public"."follow_ups" USING "btree" ("organization_id");



CREATE INDEX "idx_follow_ups_status" ON "public"."follow_ups" USING "btree" ("status");



CREATE INDEX "idx_inventory_agent" ON "public"."inventory" USING "btree" ("agent_id");



CREATE INDEX "idx_inventory_lots_organization_id" ON "public"."inventory_lots" USING "btree" ("organization_id");



CREATE INDEX "idx_inventory_lots_product_id" ON "public"."inventory_lots" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_lots_received_at" ON "public"."inventory_lots" USING "btree" ("organization_id", "product_id", "received_at");



CREATE INDEX "idx_inventory_org" ON "public"."inventory" USING "btree" ("organization_id");



CREATE INDEX "idx_inventory_product" ON "public"."inventory" USING "btree" ("product_id");



CREATE INDEX "idx_monthly_summary_org_year_month" ON "public"."monthly_summary" USING "btree" ("organization_id", "year", "month");



CREATE INDEX "idx_order_assignment_settings_org" ON "public"."order_assignment_settings" USING "btree" ("organization_id");



CREATE INDEX "idx_order_assignment_weights_org" ON "public"."order_assignment_weights" USING "btree" ("organization_id");



CREATE INDEX "idx_order_inventory_consumption_lot_id" ON "public"."order_inventory_consumption" USING "btree" ("inventory_lot_id");



CREATE INDEX "idx_order_inventory_consumption_order_id" ON "public"."order_inventory_consumption" USING "btree" ("order_id");



CREATE INDEX "idx_order_inventory_consumption_organization_id" ON "public"."order_inventory_consumption" USING "btree" ("organization_id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_product_id" ON "public"."order_items" USING "btree" ("product_id");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_organization_id" ON "public"."orders" USING "btree" ("organization_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_organization_members_org_id" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_members_org_user" ON "public"."organization_members" USING "btree" ("organization_id", "user_id");



CREATE INDEX "idx_organization_members_role" ON "public"."organization_members" USING "btree" ("role");



CREATE INDEX "idx_organization_members_user_id" ON "public"."organization_members" USING "btree" ("user_id");



CREATE INDEX "idx_organizations_name" ON "public"."organizations" USING "btree" ("name");



CREATE INDEX "idx_product_price_history_active" ON "public"."product_price_history" USING "btree" ("product_id", "ends_at") WHERE ("ends_at" IS NULL);



CREATE INDEX "idx_product_price_history_product_id" ON "public"."product_price_history" USING "btree" ("product_id");



CREATE INDEX "idx_products_active" ON "public"."products" USING "btree" ("active");



CREATE INDEX "idx_products_organization_id" ON "public"."products" USING "btree" ("organization_id");



CREATE INDEX "idx_products_type" ON "public"."products" USING "btree" ("type");



CREATE INDEX "idx_stock_movements_batch" ON "public"."stock_movements" USING "btree" ("waybill_batch_id") WHERE ("waybill_batch_id" IS NOT NULL);



CREATE INDEX "idx_stock_movements_from" ON "public"."stock_movements" USING "btree" ("from_agent_id");



CREATE INDEX "idx_stock_movements_org" ON "public"."stock_movements" USING "btree" ("organization_id");



CREATE INDEX "idx_stock_movements_product" ON "public"."stock_movements" USING "btree" ("organization_id", "product_id", "occurred_at" DESC);



CREATE INDEX "idx_stock_movements_to" ON "public"."stock_movements" USING "btree" ("to_agent_id");



CREATE INDEX "idx_unified_expenses_agent" ON "public"."unified_expenses" USING "btree" ("agent_id") WHERE ("scope" = 'agent'::"text");



CREATE INDEX "idx_unified_expenses_cat" ON "public"."unified_expenses" USING "btree" ("organization_id", "category");



CREATE INDEX "idx_unified_expenses_org" ON "public"."unified_expenses" USING "btree" ("organization_id", "occurred_at" DESC);



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE INDEX "idx_user_profiles_email_verified" ON "public"."user_profiles" USING "btree" ("email_verified");



CREATE INDEX "idx_user_profiles_role" ON "public"."user_profiles" USING "btree" ("role");



CREATE INDEX "idx_waybills_delivery" ON "public"."waybills" USING "btree" ("delivery_id");



CREATE INDEX "idx_waybills_org" ON "public"."waybills" USING "btree" ("organization_id");



CREATE INDEX "idx_waybills_status" ON "public"."waybills" USING "btree" ("status");



CREATE UNIQUE INDEX "uq_stock_movements_legacy_delivery" ON "public"."stock_movements" USING "btree" ("legacy_delivery_id") WHERE ("legacy_delivery_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_unified_expenses_agent_legacy" ON "public"."unified_expenses" USING "btree" ("legacy_agent_expense_id") WHERE ("legacy_agent_expense_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_unified_expenses_general_legacy" ON "public"."unified_expenses" USING "btree" ("legacy_general_expense_id") WHERE ("legacy_general_expense_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "extract_form_response_constants_trigger" BEFORE INSERT OR UPDATE ON "public"."form_responses" FOR EACH ROW EXECUTE FUNCTION "public"."extract_form_response_constants"();



CREATE OR REPLACE TRIGGER "trg_customer_orders_updated" BEFORE UPDATE ON "public"."customer_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_customer_orders"();



CREATE OR REPLACE TRIGGER "update_abandoned_carts_updated_at" BEFORE UPDATE ON "public"."abandoned_carts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "follow_ups_set_organization_id" BEFORE INSERT OR UPDATE ON "public"."follow_ups" FOR EACH ROW EXECUTE FUNCTION "public"."set_follow_up_organization_id"();



CREATE OR REPLACE TRIGGER "organization_invitations_defaults" BEFORE INSERT OR UPDATE ON "public"."organization_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_invitation_defaults"();



CREATE OR REPLACE TRIGGER "update_field_mappings_updated_at" BEFORE UPDATE ON "public"."field_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_form_response_profit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."form_response_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_form_response_profit"();



CREATE OR REPLACE TRIGGER "update_form_responses_updated_at" BEFORE UPDATE ON "public"."form_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_follow_ups_updated_at" BEFORE UPDATE ON "public"."follow_ups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_forms_updated_at" BEFORE UPDATE ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_lots_updated_at" BEFORE UPDATE ON "public"."inventory_lots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organization_members_updated_at" BEFORE UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."abandoned_carts"
    ADD CONSTRAINT "abandoned_carts_converted_order_id_fkey" FOREIGN KEY ("converted_order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."abandoned_carts"
    ADD CONSTRAINT "abandoned_carts_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."abandoned_carts"
    ADD CONSTRAINT "abandoned_carts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_expenses"
    ADD CONSTRAINT "agent_expenses_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_expenses"
    ADD CONSTRAINT "agent_expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."csr_name_aliases"
    ADD CONSTRAINT "csr_name_aliases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."csr_name_aliases"
    ADD CONSTRAINT "csr_name_aliases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_order_items"
    ADD CONSTRAINT "customer_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_order_items"
    ADD CONSTRAINT "customer_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."customer_orders"
    ADD CONSTRAINT "customer_orders_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_orders"
    ADD CONSTRAINT "customer_orders_csr_id_fkey" FOREIGN KEY ("csr_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_orders"
    ADD CONSTRAINT "customer_orders_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_orders"
    ADD CONSTRAINT "customer_orders_form_response_id_fkey" FOREIGN KEY ("form_response_id") REFERENCES "public"."form_responses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_orders"
    ADD CONSTRAINT "customer_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_verification_otps"
    ADD CONSTRAINT "email_verification_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."field_mappings"
    ADD CONSTRAINT "field_mappings_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."field_mappings"
    ADD CONSTRAINT "field_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_incentives"
    ADD CONSTRAINT "form_incentives_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_incentives"
    ADD CONSTRAINT "form_incentives_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_products"
    ADD CONSTRAINT "form_products_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_products"
    ADD CONSTRAINT "form_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_response_items"
    ADD CONSTRAINT "form_response_items_form_response_id_fkey" FOREIGN KEY ("form_response_id") REFERENCES "public"."form_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_response_items"
    ADD CONSTRAINT "form_response_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_converted_response_id_fkey" FOREIGN KEY ("converted_response_id") REFERENCES "public"."form_responses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_csr_id_fkey" FOREIGN KEY ("csr_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_abandoned_cart_id_fkey" FOREIGN KEY ("abandoned_cart_id") REFERENCES "public"."abandoned_carts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_lots"
    ADD CONSTRAINT "inventory_lots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_lots"
    ADD CONSTRAINT "inventory_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."monthly_summary"
    ADD CONSTRAINT "monthly_summary_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_assignment_settings"
    ADD CONSTRAINT "order_assignment_settings_last_assigned_user_id_fkey" FOREIGN KEY ("last_assigned_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_assignment_settings"
    ADD CONSTRAINT "order_assignment_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_assignment_weights"
    ADD CONSTRAINT "order_assignment_weights_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_assignment_weights"
    ADD CONSTRAINT "order_assignment_weights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_inventory_consumption"
    ADD CONSTRAINT "order_inventory_consumption_inventory_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."order_inventory_consumption"
    ADD CONSTRAINT "order_inventory_consumption_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."form_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_inventory_consumption"
    ADD CONSTRAINT "order_inventory_consumption_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."form_response_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_inventory_consumption"
    ADD CONSTRAINT "order_inventory_consumption_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_price_history"
    ADD CONSTRAINT "product_price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_from_agent_id_fkey" FOREIGN KEY ("from_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_to_agent_id_fkey" FOREIGN KEY ("to_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unified_expenses"
    ADD CONSTRAINT "unified_expenses_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unified_expenses"
    ADD CONSTRAINT "unified_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unified_expenses"
    ADD CONSTRAINT "unified_expenses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unified_expenses"
    ADD CONSTRAINT "unified_expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unified_expenses"
    ADD CONSTRAINT "unified_expenses_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waybills"
    ADD CONSTRAINT "waybills_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."waybills"
    ADD CONSTRAINT "waybills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can create organizations" ON "public"."organizations" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));






CREATE POLICY "Owners and Admins can add members" ON "public"."organization_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]));



CREATE POLICY "Owners and Admins can view all org members" ON "public"."organization_members" FOR SELECT TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]));



CREATE POLICY "Owners and Admins can update member roles" ON "public"."organization_members" FOR UPDATE USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]));



CREATE POLICY "Owners can remove members" ON "public"."organization_members" FOR DELETE USING ("public"."has_org_role"("organization_id", 'Owner'::"text"));



CREATE POLICY "Owners can update any profile in their organizations" ON "public"."user_profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."role" = 'Owner'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."organization_members" "om2"
          WHERE (("om2"."organization_id" = "om"."organization_id") AND ("om2"."user_id" = "user_profiles"."id"))))))));



CREATE POLICY "Public can create order items via form token" ON "public"."order_items" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Public can create orders via form token" ON "public"."orders" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Public can insert abandoned carts" ON "public"."abandoned_carts" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Public can view form incentives by form token" ON "public"."form_incentives" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_incentives"."form_id") AND ("f"."active" = true)))));



CREATE POLICY "Public can view form products by form token" ON "public"."form_products" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_products"."form_id") AND ("f"."active" = true)))));



CREATE POLICY "Public can view forms by token" ON "public"."forms" FOR SELECT TO "anon" USING (("active" = true));



CREATE POLICY "Public can view products for active forms" ON "public"."products" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."form_products" "fp"
     JOIN "public"."forms" "f" ON (("f"."id" = "fp"."form_id")))
  WHERE (("fp"."product_id" = "products"."id") AND ("f"."active" = true)))));



CREATE POLICY "Service role can insert abandoned carts" ON "public"."abandoned_carts" FOR INSERT TO "anon", "service_role" WITH CHECK (true);



CREATE POLICY "Service role full access form_response_items" ON "public"."form_response_items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access form_responses" ON "public"."form_responses" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access inventory_lots" ON "public"."inventory_lots" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access order_inventory_consumption" ON "public"."order_inventory_consumption" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can add themselves to organizations" ON "public"."organization_members" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create agents in their organization" ON "public"."agents" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]));



CREATE POLICY "Users can create forms in their organization" ON "public"."forms" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]));



CREATE POLICY "Users can create order items in their organization" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can create orders in their organization" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete abandoned carts in their organization" ON "public"."abandoned_carts" FOR DELETE TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]));



CREATE POLICY "Users can delete agents in their organization" ON "public"."agents" FOR DELETE TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]));



CREATE POLICY "Users can delete forms in their organization" ON "public"."forms" FOR DELETE TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]));



CREATE POLICY "Users can delete order items in their organization" ON "public"."order_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND "public"."has_any_org_role"("o"."organization_id", ARRAY['Owner'::"text", 'Admin'::"text"])))));



CREATE POLICY "Users can delete orders in their organization" ON "public"."orders" FOR DELETE TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]));



CREATE POLICY "Users can insert abandoned carts in their organization" ON "public"."abandoned_carts" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own OTPs" ON "public"."email_verification_otps" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage field_mappings in their org" ON "public"."field_mappings" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage form incentives in their organization" ON "public"."form_incentives" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_incentives"."form_id") AND "public"."has_any_org_role"("f"."organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_incentives"."form_id") AND "public"."has_any_org_role"("f"."organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"])))));



CREATE POLICY "Users can manage form products in their organization" ON "public"."form_products" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_products"."form_id") AND "public"."has_any_org_role"("f"."organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_products"."form_id") AND "public"."has_any_org_role"("f"."organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"])))));



CREATE POLICY "Users can manage form_responses in their org" ON "public"."form_responses" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage inventory_lots in their org" ON "public"."inventory_lots" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage product price history in their organization" ON "public"."product_price_history" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_price_history"."product_id") AND ("p"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_price_history"."product_id") AND ("p"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"])))))))));



CREATE POLICY "Users can manage products in their organization" ON "public"."products" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"])))))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]))))));



CREATE POLICY "Users can update abandoned carts in their organization" ON "public"."abandoned_carts" FOR UPDATE TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"])) WITH CHECK ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]));



CREATE POLICY "Users can update agents in their organization" ON "public"."agents" FOR UPDATE TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"])) WITH CHECK ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]));



CREATE POLICY "Users can update forms in their organization" ON "public"."forms" FOR UPDATE TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"])) WITH CHECK ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]));



CREATE POLICY "Users can update order items in their organization" ON "public"."order_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND "public"."has_any_org_role"("o"."organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND "public"."has_any_org_role"("o"."organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"])))));



CREATE POLICY "Users can update orders in their organization" ON "public"."orders" FOR UPDATE TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"])) WITH CHECK ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]));



CREATE POLICY "Users can update own OTPs" ON "public"."email_verification_otps" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND ("role" = ( SELECT "user_profiles_1"."role"
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE ("user_profiles_1"."id" = "auth"."uid"())))));



CREATE POLICY "Users can view abandoned carts in their organization" ON "public"."abandoned_carts" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view agents in their organization" ON "public"."agents" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM "public"."organization_members" "om"
  WHERE ("om"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view field_mappings in their org" ON "public"."field_mappings" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view form incentives in their organization" ON "public"."form_incentives" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_incentives"."form_id") AND ("f"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view form products in their organization" ON "public"."form_products" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_products"."form_id") AND ("f"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view form_response_items in their org" ON "public"."form_response_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."form_responses" "fr"
  WHERE (("fr"."id" = "form_response_items"."form_response_id") AND ("fr"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view form_responses in their org" ON "public"."form_responses" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view forms in their organization" ON "public"."forms" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view inventory_lots in their org" ON "public"."inventory_lots" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view order items in their organization" ON "public"."order_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view order_inventory_consumption in their org" ON "public"."order_inventory_consumption" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view orders in their organization" ON "public"."orders" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view organization members" ON "public"."organization_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own OTPs" ON "public"."email_verification_otps" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view product price history in their organization" ON "public"."product_price_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_price_history"."product_id") AND ("p"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view products in their organization" ON "public"."products" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view profiles in their organizations" ON "public"."user_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
           FROM "public"."organization_members" "om2"
          WHERE (("om2"."organization_id" = "om"."organization_id") AND ("om2"."user_id" = "user_profiles"."id"))))))));



CREATE POLICY "Users can view their organizations" ON "public"."organizations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organizations"."id") AND ("om"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."abandoned_carts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activities_insert" ON "public"."activities" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "activities_select" ON "public"."activities" FOR SELECT TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]));



ALTER TABLE "public"."agent_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."csr_name_aliases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "csr_name_aliases_all" ON "public"."csr_name_aliases" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."customer_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_order_items_all" ON "public"."customer_order_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."customer_orders" "o"
  WHERE (("o"."id" = "customer_order_items"."order_id") AND ("o"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."customer_orders" "o"
  WHERE (("o"."id" = "customer_order_items"."order_id") AND ("o"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."customer_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_orders_delete" ON "public"."customer_orders" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "customer_orders_insert" ON "public"."customer_orders" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "customer_orders_select" ON "public"."customer_orders" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "customer_orders_update" ON "public"."customer_orders" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deliveries_delete" ON "public"."deliveries" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "deliveries_insert" ON "public"."deliveries" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "deliveries_select" ON "public"."deliveries" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "deliveries_update" ON "public"."deliveries" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."email_verification_otps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."field_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_incentives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_response_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follow_ups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "follow_ups_delete" ON "public"."follow_ups" FOR DELETE TO "authenticated" USING (("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]) OR ("assigned_to" = "auth"."uid"())));



CREATE POLICY "follow_ups_insert" ON "public"."follow_ups" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "follow_ups_select" ON "public"."follow_ups" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "follow_ups_update" ON "public"."follow_ups" FOR UPDATE TO "authenticated" USING ((("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))) AND (("assigned_to" = "auth"."uid"()) OR "public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text", 'Manager'::"text"]))));



ALTER TABLE "public"."forms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_delete" ON "public"."inventory" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "inventory_insert" ON "public"."inventory" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."inventory_lots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_select" ON "public"."inventory" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "inventory_update" ON "public"."inventory" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."monthly_summary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_assignment_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_assignment_settings_delete" ON "public"."order_assignment_settings" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "order_assignment_settings_insert" ON "public"."order_assignment_settings" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "order_assignment_settings_select" ON "public"."order_assignment_settings" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "order_assignment_settings_update" ON "public"."order_assignment_settings" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."order_assignment_weights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_assignment_weights_delete" ON "public"."order_assignment_weights" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "order_assignment_weights_insert" ON "public"."order_assignment_weights" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "order_assignment_weights_select" ON "public"."order_assignment_weights" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "order_assignment_weights_update" ON "public"."order_assignment_weights" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."order_inventory_consumption" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_invitations_delete" ON "public"."organization_invitations" FOR DELETE TO "authenticated" USING ("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]));



CREATE POLICY "org_invitations_insert" ON "public"."organization_invitations" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]) AND ("invited_by" = "auth"."uid"())));



CREATE POLICY "org_invitations_select" ON "public"."organization_invitations" FOR SELECT TO "authenticated" USING (("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]) OR ("lower"("email") = "lower"(COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text")))));



CREATE POLICY "org_invitations_update" ON "public"."organization_invitations" FOR UPDATE TO "authenticated" USING (("public"."has_any_org_role"("organization_id", ARRAY['Owner'::"text", 'Admin'::"text"]) OR (("lower"("email") = "lower"(COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text"))) AND ("accepted_at" IS NULL))));



ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_price_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_movements_all" ON "public"."stock_movements" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."unified_expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unified_expenses_all" ON "public"."unified_expenses" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waybills" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."accept_organization_invitation"("inv_code" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_missing_user_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_missing_user_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_missing_user_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_form_response_gross_profit"("p_order_revenue" numeric, "p_order_cost" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."compute_form_response_gross_profit"("p_order_revenue" numeric, "p_order_cost" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_form_response_gross_profit"("p_order_revenue" numeric, "p_order_cost" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_form_response_net_profit"("p_order_revenue" numeric, "p_order_cost" numeric, "p_delivery_fee" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."compute_form_response_net_profit"("p_order_revenue" numeric, "p_order_cost" numeric, "p_delivery_fee" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_form_response_net_profit"("p_order_revenue" numeric, "p_order_cost" numeric, "p_delivery_fee" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_order_from_normalized_submission"("p_organization_id" "uuid", "p_form_id" "uuid", "p_source" "text", "p_page_url" "text", "p_field_values" "jsonb", "p_items" "jsonb", "p_raw_payload" "jsonb", "p_normalized_payload" "jsonb", "p_package" "text", "p_offer_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_order_from_normalized_submission"("p_organization_id" "uuid", "p_form_id" "uuid", "p_source" "text", "p_page_url" "text", "p_field_values" "jsonb", "p_items" "jsonb", "p_raw_payload" "jsonb", "p_normalized_payload" "jsonb", "p_package" "text", "p_offer_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_order_from_normalized_submission"("p_organization_id" "uuid", "p_form_id" "uuid", "p_source" "text", "p_page_url" "text", "p_field_values" "jsonb", "p_items" "jsonb", "p_raw_payload" "jsonb", "p_normalized_payload" "jsonb", "p_package" "text", "p_offer_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_organization_with_owner"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_organization_with_owner"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organization_with_owner"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_verification_otp"("p_email" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_verification_otp"("p_email" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_verification_otp"("p_email" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_verification_otp_uuid_text"("p_user_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_verification_otp_uuid_text"("p_user_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_verification_otp_uuid_text"("p_user_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_form_response_constants"() TO "anon";
GRANT ALL ON FUNCTION "public"."extract_form_response_constants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_form_response_constants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_otp"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_otp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_otp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_org_role"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_org_role"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_org_role"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_organizations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organizations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organizations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_email_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_email_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_email_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_any_org_role"("org_id" "uuid", "required_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_any_org_role"("org_id" "uuid", "required_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_any_org_role"("org_id" "uuid", "required_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_org_role"("org_id" "uuid", "required_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_org_role"("org_id" "uuid", "required_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_org_role"("org_id" "uuid", "required_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_member"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_member"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_member"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_csr_user_id"("p_organization_id" "uuid", "p_raw" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_csr_user_id"("p_organization_id" "uuid", "p_raw" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_csr_user_id"("p_organization_id" "uuid", "p_raw" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_follow_up_organization_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_follow_up_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_follow_up_organization_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_invitation_defaults"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_invitation_defaults"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_invitation_defaults"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_customer_orders"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_customer_orders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_customer_orders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_form_response_profit"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_form_response_profit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_form_response_profit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_otp"("p_otp_code" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_otp"("p_otp_code" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_otp"("p_otp_code" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_otp_uuid_text"("p_user_id" "uuid", "p_otp_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_otp_uuid_text"("p_user_id" "uuid", "p_otp_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_otp_uuid_text"("p_user_id" "uuid", "p_otp_code" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."abandoned_carts" TO "anon";
GRANT ALL ON TABLE "public"."abandoned_carts" TO "authenticated";
GRANT ALL ON TABLE "public"."abandoned_carts" TO "service_role";



GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."activities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."activities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."activities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."agent_expenses" TO "anon";
GRANT ALL ON TABLE "public"."agent_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_expenses" TO "service_role";



GRANT ALL ON SEQUENCE "public"."agent_expenses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."agent_expenses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."agent_expenses_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."agent_stock_breakdown_v" TO "anon";
GRANT ALL ON TABLE "public"."agent_stock_breakdown_v" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_stock_breakdown_v" TO "service_role";



GRANT ALL ON TABLE "public"."agent_stock_v" TO "anon";
GRANT ALL ON TABLE "public"."agent_stock_v" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_stock_v" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."agents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."agents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."agents_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."csr_name_aliases" TO "anon";
GRANT ALL ON TABLE "public"."csr_name_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."csr_name_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."customer_order_items" TO "anon";
GRANT ALL ON TABLE "public"."customer_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."customer_orders" TO "anon";
GRANT ALL ON TABLE "public"."customer_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_orders" TO "service_role";



GRANT ALL ON TABLE "public"."deliveries" TO "anon";
GRANT ALL ON TABLE "public"."deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."deliveries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."deliveries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."deliveries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."deliveries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."email_verification_otps" TO "anon";
GRANT ALL ON TABLE "public"."email_verification_otps" TO "authenticated";
GRANT ALL ON TABLE "public"."email_verification_otps" TO "service_role";



GRANT ALL ON TABLE "public"."field_mappings" TO "anon";
GRANT ALL ON TABLE "public"."field_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."field_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."form_incentives" TO "anon";
GRANT ALL ON TABLE "public"."form_incentives" TO "authenticated";
GRANT ALL ON TABLE "public"."form_incentives" TO "service_role";



GRANT ALL ON TABLE "public"."form_products" TO "anon";
GRANT ALL ON TABLE "public"."form_products" TO "authenticated";
GRANT ALL ON TABLE "public"."form_products" TO "service_role";



GRANT ALL ON TABLE "public"."form_response_items" TO "anon";
GRANT ALL ON TABLE "public"."form_response_items" TO "authenticated";
GRANT ALL ON TABLE "public"."form_response_items" TO "service_role";



GRANT ALL ON TABLE "public"."form_responses" TO "anon";
GRANT ALL ON TABLE "public"."form_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."form_responses" TO "service_role";



GRANT ALL ON TABLE "public"."forms" TO "anon";
GRANT ALL ON TABLE "public"."forms" TO "authenticated";
GRANT ALL ON TABLE "public"."forms" TO "service_role";



GRANT ALL ON TABLE "public"."follow_ups" TO "anon";
GRANT ALL ON TABLE "public"."follow_ups" TO "authenticated";
GRANT ALL ON TABLE "public"."follow_ups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."follow_ups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."follow_ups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."follow_ups_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT ALL ON TABLE "public"."inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_lots" TO "anon";
GRANT ALL ON TABLE "public"."inventory_lots" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_lots" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_summary" TO "anon";
GRANT ALL ON TABLE "public"."monthly_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_summary" TO "service_role";



GRANT ALL ON SEQUENCE "public"."monthly_summary_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."monthly_summary_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."monthly_summary_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_assignment_settings" TO "anon";
GRANT ALL ON TABLE "public"."order_assignment_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."order_assignment_settings" TO "service_role";



GRANT ALL ON TABLE "public"."order_assignment_weights" TO "anon";
GRANT ALL ON TABLE "public"."order_assignment_weights" TO "authenticated";
GRANT ALL ON TABLE "public"."order_assignment_weights" TO "service_role";



GRANT ALL ON TABLE "public"."order_inventory_consumption" TO "anon";
GRANT ALL ON TABLE "public"."order_inventory_consumption" TO "authenticated";
GRANT ALL ON TABLE "public"."order_inventory_consumption" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."organization_invitations" TO "anon";
GRANT ALL ON TABLE "public"."organization_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."product_price_history" TO "anon";
GRANT ALL ON TABLE "public"."product_price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."product_price_history" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."unified_expenses" TO "anon";
GRANT ALL ON TABLE "public"."unified_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."unified_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."v_monthly_delivery_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_monthly_delivery_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_monthly_delivery_summary" TO "service_role";



GRANT ALL ON TABLE "public"."waybills" TO "anon";
GRANT ALL ON TABLE "public"."waybills" TO "authenticated";
GRANT ALL ON TABLE "public"."waybills" TO "service_role";



GRANT ALL ON SEQUENCE "public"."waybills_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."waybills_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."waybills_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































