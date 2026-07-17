-- Surcharge feature migration
-- Run in Supabase SQL editor

-- Add surcharge columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS surcharge_amount numeric(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS surcharge_percentage numeric(5,2) DEFAULT 0 NOT NULL;

-- Add surcharge_config column to site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS surcharge_config jsonb DEFAULT '{"surcharge_active":false,"surcharge_percent":0,"surcharge_min_order":0,"surcharge_message":"A processing surcharge may apply to certain credit card payments. If applicable, it will be calculated and displayed in your order summary before you place your order."}'::jsonb;
