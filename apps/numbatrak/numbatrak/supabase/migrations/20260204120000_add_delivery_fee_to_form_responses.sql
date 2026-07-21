-- Add delivery_fee column to form_responses
-- Delivery fee is subtracted from profit when displaying

ALTER TABLE form_responses
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) DEFAULT 0;

COMMENT ON COLUMN form_responses.delivery_fee IS 'Delivery fee (cost) – subtracted from profit for net profit display';
