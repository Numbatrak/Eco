-- ============================================
-- Create Abandoned Carts Table
-- ============================================
-- This table stores abandoned cart data from WordPress forms
-- Run this script in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id BIGSERIAL PRIMARY KEY,
  customer_name TEXT,
  phone_number TEXT,
  whatsapp_number TEXT,
  delivery_address TEXT,
  state TEXT,
  location TEXT, -- Combined delivery_address + state
  -- Order-like fields (so abandoned carts can share the same schema shape as orders)
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_month TEXT,
  order_year TEXT,
  selected_package TEXT,
  selected_items TEXT,
  product_name TEXT,
  mail_quan INTEGER,
  agent_quan INTEGER,
  quantity INTEGER,
  product2 TEXT,
  mail_quan2 INTEGER,
  agent_quan2 INTEGER,
  quantity2 INTEGER,
  cost_price DECIMAL(10, 2),
  delivery_fee DECIMAL(10, 2),
  sales_price NUMERIC(10, 2),
  profit DECIMAL(10, 2),
  page_url TEXT,
  filled_fields_count INTEGER DEFAULT 0,
  abandoned_at TIMESTAMPTZ DEFAULT NOW(),
  converted_to_order BOOLEAN DEFAULT FALSE,
  converted_order_id BIGINT, -- Reference to orders.id if converted
  order_status TEXT DEFAULT 'Pending',
  delivery_date DATE,
  delivery_month TEXT,
  delivery_year TEXT,
  confirmed_delivery BOOLEAN DEFAULT FALSE,
  agent_name TEXT,
  note TEXT,
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if this table already exists (e.g. from a newer schema)
-- We add the legacy columns used by the app, only if they are missing.
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS selected_package TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS selected_items TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS mail_quan INTEGER;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS agent_quan INTEGER;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS product2 TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS mail_quan2 INTEGER;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS agent_quan2 INTEGER;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS quantity2 INTEGER;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS page_url TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS filled_fields_count INTEGER DEFAULT 0;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS subject TEXT;

-- Create index for faster queries (only if columns exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'abandoned_carts' AND column_name = 'abandoned_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_abandoned_carts_abandoned_at
      ON public.abandoned_carts(abandoned_at DESC);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'abandoned_carts' AND column_name = 'converted_to_order'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_abandoned_carts_converted
      ON public.abandoned_carts(converted_to_order);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'abandoned_carts' AND column_name = 'customer_name'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_abandoned_carts_customer_name
      ON public.abandoned_carts(customer_name);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view abandoned carts
CREATE POLICY "Authenticated users can view abandoned carts"
  ON abandoned_carts FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow service role to insert (for WordPress webhooks)
CREATE POLICY "Service role can insert abandoned carts"
  ON abandoned_carts FOR INSERT
  TO service_role, anon
  WITH CHECK (true);

-- Create policy to allow authenticated users to update abandoned carts
CREATE POLICY "Authenticated users can update abandoned carts"
  ON abandoned_carts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policy to allow authenticated users to delete abandoned carts
CREATE POLICY "Authenticated users can delete abandoned carts"
  ON abandoned_carts FOR DELETE
  TO authenticated
  USING (true);

-- Add comment to table
COMMENT ON TABLE abandoned_carts IS 'Stores abandoned cart data from WordPress Fluent Forms';

-- =========================
-- Backfill/upgrade existing schemas (idempotent)
-- =========================
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS order_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS order_month TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS order_year TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2);
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2);
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS profit DECIMAL(10, 2);
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'Pending';
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS delivery_month TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS delivery_year TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS confirmed_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS subject TEXT;

-- Ensure legacy pricing/order fields exist too (for compatibility with order-shaped UI).
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS sales_price NUMERIC(10, 2);
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2);
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2);
ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS profit DECIMAL(10, 2);






